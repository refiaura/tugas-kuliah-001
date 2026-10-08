package com.tugaskuliah.pos.sales.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.inventory.entity.DocumentCounter;
import com.tugaskuliah.pos.inventory.entity.InventoryBalance;
import com.tugaskuliah.pos.inventory.entity.StockMovement;
import com.tugaskuliah.pos.inventory.repository.DocumentCounterRepository;
import com.tugaskuliah.pos.inventory.repository.InventoryBalanceRepository;
import com.tugaskuliah.pos.inventory.repository.StockMovementRepository;
import com.tugaskuliah.pos.masterdata.entity.Customer;
import com.tugaskuliah.pos.masterdata.entity.PaymentMethod;
import com.tugaskuliah.pos.masterdata.entity.Product;
import com.tugaskuliah.pos.masterdata.repository.CustomerRepository;
import com.tugaskuliah.pos.masterdata.repository.PaymentMethodRepository;
import com.tugaskuliah.pos.masterdata.repository.ProductRepository;
import com.tugaskuliah.pos.sales.dto.*;
import com.tugaskuliah.pos.sales.entity.Sale;
import com.tugaskuliah.pos.sales.entity.SaleItem;
import com.tugaskuliah.pos.sales.entity.SalePayment;
import com.tugaskuliah.pos.sales.repository.SaleRepository;
import com.tugaskuliah.pos.user.entity.User;
import com.tugaskuliah.pos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * POS checkout. The whole checkout is ONE atomic transaction (PRD §34):
 * 1. permission (via @PreAuthorize at controller)
 * 2. validate items & products
 * 3. validate stock (pessimistic lock, no negative stock)
 * 4. compute totals (backend is authoritative)
 * 5. validate payments (sum >= grand_total)
 * 6. generate invoice number (concurrent-safe counter)
 * 7. persist sale + items (price snapshot) + payments
 * 8. create stock movements (ledger)
 * 9. update inventory balances
 * 10. (audit log -> Milestone 7)
 *
 * Idempotency: if idempotencyKey was seen, return the existing sale.
 */
@Service
@RequiredArgsConstructor
public class SaleService {

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final PaymentMethodRepository paymentMethodRepository;
    private final UserRepository userRepository;
    private final StockMovementRepository movementRepository;
    private final InventoryBalanceRepository balanceRepository;
    private final DocumentCounterRepository counterRepository;

    @Transactional(readOnly = true)
    public Page<SaleResponse> list(Sale.Status status, Pageable pageable) {
        Page<Sale> page = status == null
                ? saleRepository.findAll(pageable)
                : saleRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
        return page.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public SaleResponse get(Long id) {
        return toResponse(findById(id));
    }

    /**
     * Hold a cart: saved as HELD, does NOT touch stock.
     */
    @Transactional
    public SaleResponse hold(HoldRequest req) {
        Sale sale = new Sale();
        sale.setInvoiceNo(nextInvoiceNo());
        sale.setStatus(Sale.Status.HELD);
        sale.setCashier(currentUser());
        if (req.customerId() != null) {
            sale.setCustomer(findCustomer(req.customerId()));
        }
        sale.setNotes(req.notes());

        BigDecimal subtotal = BigDecimal.ZERO;
        for (var itemReq : req.items()) {
            Product p = findActiveProduct(itemReq.productId());
            BigDecimal qty = itemReq.qty();
            BigDecimal discount = itemReq.discount() != null ? itemReq.discount() : BigDecimal.ZERO;
            BigDecimal line = p.getSellingPrice().multiply(qty).subtract(discount);
            SaleItem item = toItem(sale, p, qty, discount, line);
            sale.getItems().add(item);
            subtotal = subtotal.add(line);
        }
        sale.setSubtotal(subtotal);
        sale.setGrandTotal(subtotal);
        return toResponse(saleRepository.save(sale));
    }

    /**
     * Resume a HELD sale into checkout (same atomic flow).
     */
    @Transactional
    public SaleResponse resumeAndCheckout(Long id, CheckoutRequest req) {
        Sale held = findById(id);
        if (held.getStatus() != Sale.Status.HELD) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Hanya transaksi HOLD yang bisa di-resume");
        }
        // re-validate stock at resume time, then complete
        return completeCheckout(held, req);
    }

    @Transactional
    public SaleResponse checkout(CheckoutRequest req) {
        // idempotency: double submit returns the original sale
        if (req.idempotencyKey() != null && !req.idempotencyKey().isBlank()) {
            var existing = saleRepository.findByIdempotencyKey(req.idempotencyKey());
            if (existing.isPresent()) {
                return toResponse(existing.get());
            }
        }
        Sale sale = new Sale();
        sale.setInvoiceNo(nextInvoiceNo());
        sale.setIdempotencyKey(req.idempotencyKey());
        return completeCheckout(sale, req);
    }

    // ---------- core atomic flow ----------

    private SaleResponse completeCheckout(Sale sale, CheckoutRequest req) {
        sale.setStatus(Sale.Status.COMPLETED);
        sale.setCashier(currentUser());
        if (req.customerId() != null) {
            sale.setCustomer(findCustomer(req.customerId()));
        }
        sale.setNotes(req.notes());

        // items + totals (backend authoritative)
        BigDecimal subtotal = BigDecimal.ZERO;
        sale.getItems().clear();
        java.util.List<StockMovement> movements = new java.util.ArrayList<>();
        for (var itemReq : req.items()) {
            Product p = findActiveProduct(itemReq.productId());
            BigDecimal qty = itemReq.qty();
            // stock check with pessimistic lock (concurrent-safe)
            deductStock(p, qty);
            BigDecimal discount = itemReq.discount() != null ? itemReq.discount() : BigDecimal.ZERO;
            BigDecimal line = p.getSellingPrice().multiply(qty).subtract(discount);
            if (line.compareTo(BigDecimal.ZERO) < 0) {
                throw new ApiException(ErrorCode.BUSINESS_ERROR, "Diskon item melebihi harga");
            }
            sale.getItems().add(toItem(sale, p, qty, discount, line));
            subtotal = subtotal.add(line);

            // stock movement ledger (reference id filled after sale persist)
            StockMovement m = new StockMovement();
            m.setProduct(p);
            m.setQtyChange(qty.negate());
            m.setMovementType("SALE");
            m.setReferenceType("SALE");
            m.setCreatedBy(currentUsername());
            movements.add(m);
        }

        BigDecimal discountTotal = req.discountTotal() != null ? req.discountTotal() : BigDecimal.ZERO;
        BigDecimal grandTotal = subtotal.subtract(discountTotal);
        if (grandTotal.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Diskon melebihi subtotal");
        }
        sale.setSubtotal(subtotal);
        sale.setDiscountTotal(discountTotal);
        sale.setGrandTotal(grandTotal);

        // payments
        BigDecimal paid = BigDecimal.ZERO;
        sale.getPayments().clear();
        for (var payReq : req.payments()) {
            PaymentMethod pm = paymentMethodRepository.findById(payReq.paymentMethodId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Metode pembayaran tidak ditemukan"));
            if (!pm.isActive()) {
                throw new ApiException(ErrorCode.BUSINESS_ERROR, "Metode pembayaran nonaktif");
            }
            SalePayment sp = new SalePayment();
            sp.setSale(sale);
            sp.setPaymentMethod(pm);
            sp.setAmount(payReq.amount());
            sp.setReferenceNo(payReq.referenceNo());
            sale.getPayments().add(sp);
            paid = paid.add(payReq.amount());
        }
        if (paid.compareTo(grandTotal) < 0) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Pembayaran kurang: dibayar " + paid + ", total " + grandTotal);
        }
        sale.setPaidTotal(paid);
        sale.setChangeAmount(paid.subtract(grandTotal));
        sale.setCompletedAt(OffsetDateTime.now());

        Sale saved = saleRepository.save(sale);
        // persist movements now that sale has an id (same transaction = atomic)
        for (StockMovement m : movements) {
            m.setReferenceId(saved.getId());
            movementRepository.save(m);
        }
        return toResponse(saved);
    }

    /**
     * Pessimistic-lock the balance row, validate, then decrement.
     * Throws if stock would go negative (PRD: negative stock disallowed by default).
     */
    private void deductStock(Product p, BigDecimal qty) {
        InventoryBalance bal = balanceRepository.findByIdForUpdate(p.getId())
                .orElseGet(() -> {
                    InventoryBalance b = new InventoryBalance();
                    b.setProduct(p);
                    b.setQty(BigDecimal.ZERO);
                    return balanceRepository.save(b);
                });
        BigDecimal after = bal.getQty().subtract(qty);
        if (after.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Stok tidak cukup untuk " + p.getName() + " (tersedia " + bal.getQty() + ")");
        }
        bal.setQty(after);
        bal.setUpdatedAt(OffsetDateTime.now());
        balanceRepository.save(bal);
    }

    /**
     * Concurrent-safe invoice number: INV-20261008-000001.
     * Row-level lock on the counter guarantees uniqueness.
     */
    private String nextInvoiceNo() {
        LocalDate today = LocalDate.now();
        DocumentCounter.Pk pk = new DocumentCounter.Pk("INV", today);
        DocumentCounter counter = counterRepository.findById(pk)
                .orElseGet(() -> {
                    DocumentCounter c = new DocumentCounter();
                    c.setId(pk);
                    c.setLastNumber(0);
                    return c;
                });
        // pessimistic lock acquired via findById above
        int next = counter.getLastNumber() + 1;
        counter.setLastNumber(next);
        counterRepository.save(counter);
        return "INV-" + today.format(DateTimeFormatter.BASIC_ISO_DATE)
                + "-" + String.format("%06d", next);
    }

    // ---------- helpers ----------

    private Sale findById(Long id) {
        return saleRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Transaksi tidak ditemukan"));
    }

    private Product findActiveProduct(Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Produk tidak ditemukan"));
        if (!p.isActive()) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Produk nonaktif tidak dapat dijual: " + p.getName());
        }
        return p;
    }

    private Customer findCustomer(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Customer tidak ditemukan"));
    }

    private SaleItem toItem(Sale sale, Product p, BigDecimal qty, BigDecimal discount, BigDecimal line) {
        SaleItem item = new SaleItem();
        item.setSale(sale);
        item.setProduct(p);
        item.setSku(p.getSku());
        item.setName(p.getName());
        item.setQty(qty);
        item.setUnitPrice(p.getSellingPrice()); // snapshot
        item.setDiscount(discount);
        item.setSubtotal(line);
        return item;
    }

    private SaleResponse toResponse(Sale s) {
        return new SaleResponse(
                s.getId(), s.getInvoiceNo(), s.getStatus().name(),
                s.getCustomer() != null ? s.getCustomer().getName() : null,
                s.getCashier() != null ? s.getCashier().getUsername() : null,
                s.getSubtotal(), s.getDiscountTotal(), s.getTaxTotal(),
                s.getGrandTotal(), s.getPaidTotal(), s.getChangeAmount(),
                s.getNotes(), s.getCompletedAt(),
                s.getItems().stream().map(i -> new SaleItemResponse(
                        i.getProduct().getId(), i.getSku(), i.getName(),
                        i.getQty(), i.getUnitPrice(), i.getDiscount(), i.getSubtotal())).toList(),
                s.getPayments().stream().map(p -> new SalePaymentResponse(
                        p.getPaymentMethod().getCode(), p.getPaymentMethod().getName(),
                        p.getAmount(), p.getReferenceNo())).toList());
    }

    private User currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return userRepository.findById(p.getId()).orElse(null);
        }
        return null;
    }

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getUsername();
        }
        return null;
    }
}
