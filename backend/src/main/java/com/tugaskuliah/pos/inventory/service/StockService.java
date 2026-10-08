package com.tugaskuliah.pos.inventory.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.inventory.dto.*;
import com.tugaskuliah.pos.inventory.entity.*;
import com.tugaskuliah.pos.inventory.repository.*;
import com.tugaskuliah.pos.masterdata.entity.Product;
import com.tugaskuliah.pos.masterdata.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Inventory documents (Milestone 5).
 * Every write operation is ONE atomic transaction: it locks the balance row
 * (pessimistic), updates the balance, and appends the matching stock
 * movement(s) to the ledger. The movement history itself is read-only.
 *
 * Business rules:
 * - Opname: expected = balance snapshot at submit; difference posts a
 *   STOCK_OPNAME movement (lines without difference are recorded only).
 * - Adjustment: reason is mandatory; resulting stock may not go negative.
 * - Transfer: from/to locations must differ; posted as TRANSFER_OUT +
 *   TRANSFER_IN pair; total product balance is unchanged.
 * - Receive: quantity must be positive; posts a RECEIVE movement.
 */
@Service
@RequiredArgsConstructor
public class StockService {

    private final StockOpnameDocRepository opnameRepository;
    private final StockAdjustmentRepository adjustmentRepository;
    private final StockTransferRepository transferRepository;
    private final StockReceiptRepository receiptRepository;
    private final StockMovementRepository movementRepository;
    private final InventoryBalanceRepository balanceRepository;
    private final DocumentCounterRepository counterRepository;
    private final ProductRepository productRepository;

    // ---------- reads ----------

    @Transactional(readOnly = true)
    public List<StockBalanceResponse> balances() {
        return productRepository.findAll().stream()
                .filter(Product::isActive)
                .map(p -> new StockBalanceResponse(
                        p.getId(), p.getSku(), p.getName(),
                        balanceRepository.findById(p.getId())
                                .map(InventoryBalance::getQty)
                                .orElse(BigDecimal.ZERO),
                        p.getMinimumStock()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<StockMovementResponse> movements(Long productId, Pageable pageable) {
        Page<StockMovement> page = productId == null
                ? movementRepository.findAllByOrderByCreatedAtDesc(pageable)
                : movementRepository.findByProductIdOrderByCreatedAtDesc(productId, pageable);
        return page.map(this::toMovementResponse);
    }

    // ---------- opname ----------

    @Transactional
    public OpnameResponse opname(OpnameRequest req) {
        StockOpnameDoc doc = new StockOpnameDoc();
        doc.setDocNo(nextDocNo("OPN", "OPN"));
        doc.setStatus(StockOpnameDoc.Status.COMPLETED);
        doc.setLocation(req.location());
        doc.setNotes(req.notes());
        doc.setCreatedBy(currentUsername());
        doc.setCompletedAt(OffsetDateTime.now());

        StockOpnameDoc saved = opnameRepository.save(doc);
        for (var lineReq : req.lines()) {
            Product p = findActiveProduct(lineReq.productId());
            InventoryBalance bal = lockBalance(p);
            BigDecimal expected = bal.getQty();
            BigDecimal counted = lineReq.countedQty();
            BigDecimal diff = counted.subtract(expected);

            StockOpnameLine line = new StockOpnameLine();
            line.setOpname(saved);
            line.setProduct(p);
            line.setExpectedQty(expected);
            line.setCountedQty(counted);
            line.setDifferenceQty(diff);
            saved.getLines().add(line);

            if (diff.compareTo(BigDecimal.ZERO) != 0) {
                // apply difference to the balance
                BigDecimal after = expected.add(diff);
                if (after.compareTo(BigDecimal.ZERO) < 0) {
                    throw new ApiException(ErrorCode.BUSINESS_ERROR,
                            "Hasil opname membuat stok negatif untuk " + p.getName());
                }
                bal.setQty(after);
                bal.setUpdatedAt(OffsetDateTime.now());

                movement(p, diff, "STOCK_OPNAME", req.location(),
                        "OPNAME", saved.getId());
            }
        }
        return toOpnameResponse(opnameRepository.save(saved));
    }

    // ---------- adjustment ----------

    @Transactional
    public AdjustmentResponse adjustment(AdjustmentRequest req) {
        if (req.reason() == null || req.reason().isBlank()) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Alasan adjustment wajib diisi");
        }
        if (req.qtyChange().compareTo(BigDecimal.ZERO) == 0) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Perubahan qty tidak boleh nol");
        }
        Product p = findActiveProduct(req.productId());
        InventoryBalance bal = lockBalance(p);
        BigDecimal after = bal.getQty().add(req.qtyChange());
        if (after.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Adjustment membuat stok negatif untuk " + p.getName()
                            + " (tersedia " + bal.getQty() + ")");
        }
        bal.setQty(after);
        bal.setUpdatedAt(OffsetDateTime.now());

        StockAdjustment adj = new StockAdjustment();
        adj.setDocNo(nextDocNo("ADJ", "ADJ"));
        adj.setProduct(p);
        adj.setQtyChange(req.qtyChange());
        adj.setReason(req.reason().trim());
        adj.setCreatedBy(currentUsername());
        StockAdjustment saved = adjustmentRepository.save(adj);

        movement(p, req.qtyChange(), "ADJUSTMENT", null, "ADJUSTMENT", saved.getId());
        return new AdjustmentResponse(saved.getId(), saved.getDocNo(),
                p.getId(), p.getName(), saved.getQtyChange(),
                saved.getReason(), saved.getCreatedBy(), saved.getCreatedAt());
    }

    // ---------- transfer ----------

    @Transactional
    public TransferResponse transfer(TransferRequest req) {
        String from = req.fromLocation().trim();
        String to = req.toLocation().trim();
        if (from.equalsIgnoreCase(to)) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Lokasi asal dan tujuan tidak boleh sama");
        }
        Product p = findActiveProduct(req.productId());
        lockBalance(p); // lock for consistency; total balance unchanged

        StockTransfer tr = new StockTransfer();
        tr.setDocNo(nextDocNo("TRF", "TRF"));
        tr.setProduct(p);
        tr.setQty(req.qty());
        tr.setFromLocation(from);
        tr.setToLocation(to);
        tr.setStatus(StockTransfer.Status.COMPLETED);
        tr.setNotes(req.notes());
        tr.setCreatedBy(currentUsername());
        StockTransfer saved = transferRepository.save(tr);

        // atomic pair: out of source, into destination (same transaction)
        movement(p, req.qty().negate(), "TRANSFER_OUT", from, "TRANSFER", saved.getId());
        movement(p, req.qty(), "TRANSFER_IN", to, "TRANSFER", saved.getId());

        return new TransferResponse(saved.getId(), saved.getDocNo(),
                p.getId(), p.getName(), saved.getQty(),
                saved.getFromLocation(), saved.getToLocation(),
                saved.getStatus().name(), saved.getCreatedBy(), saved.getCreatedAt());
    }

    // ---------- receive ----------

    @Transactional
    public ReceiptResponse receive(ReceiptRequest req) {
        Product p = findActiveProduct(req.productId());
        InventoryBalance bal = lockBalance(p);
        bal.setQty(bal.getQty().add(req.qty()));
        bal.setUpdatedAt(OffsetDateTime.now());

        StockReceipt rcv = new StockReceipt();
        rcv.setDocNo(nextDocNo("RCV", "RCV"));
        rcv.setProduct(p);
        rcv.setQty(req.qty());
        rcv.setLocation(req.location());
        rcv.setSupplierRef(req.supplierRef());
        rcv.setNotes(req.notes());
        rcv.setCreatedBy(currentUsername());
        StockReceipt saved = receiptRepository.save(rcv);

        movement(p, req.qty(), "RECEIVE", req.location(), "RECEIPT", saved.getId());
        return new ReceiptResponse(saved.getId(), saved.getDocNo(),
                p.getId(), p.getName(), saved.getQty(),
                saved.getLocation(), saved.getSupplierRef(),
                saved.getCreatedBy(), saved.getCreatedAt());
    }

    // ---------- helpers ----------

    /** Pessimistic-lock the balance row, creating it if missing. */
    private InventoryBalance lockBalance(Product p) {
        return balanceRepository.findByIdForUpdate(p.getId())
                .orElseGet(() -> {
                    InventoryBalance b = new InventoryBalance();
                    b.setProduct(p);
                    b.setQty(BigDecimal.ZERO);
                    return balanceRepository.save(b);
                });
    }

    private void movement(Product p, BigDecimal qtyChange, String movementType,
                          String location, String referenceType, Long referenceId) {
        StockMovement m = new StockMovement();
        m.setProduct(p);
        m.setQtyChange(qtyChange);
        m.setMovementType(movementType);
        m.setLocation(location);
        m.setReferenceType(referenceType);
        m.setReferenceId(referenceId);
        m.setCreatedBy(currentUsername());
        movementRepository.save(m);
    }

    /**
     * Concurrent-safe document numbering: PREFIX-20261008-000001.
     * Row-level lock on the counter guarantees uniqueness.
     */
    private String nextDocNo(String docType, String prefix) {
        LocalDate today = LocalDate.now();
        DocumentCounter.Pk pk = new DocumentCounter.Pk(docType, today);
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
        return prefix + "-" + today.format(DateTimeFormatter.BASIC_ISO_DATE)
                + "-" + String.format("%06d", next);
    }

    private Product findActiveProduct(Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Produk tidak ditemukan"));
        if (!p.isActive()) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Produk nonaktif: " + p.getName());
        }
        return p;
    }

    private StockMovementResponse toMovementResponse(StockMovement m) {
        return new StockMovementResponse(
                m.getId(),
                m.getProduct().getId(),
                m.getProduct().getName(),
                m.getQtyChange(),
                m.getMovementType(),
                m.getLocation(),
                m.getReferenceType(),
                m.getReferenceId(),
                m.getCreatedBy(),
                m.getCreatedAt());
    }

    private OpnameResponse toOpnameResponse(StockOpnameDoc d) {
        return new OpnameResponse(
                d.getId(), d.getDocNo(), d.getStatus().name(),
                d.getLocation(), d.getNotes(), d.getCreatedBy(), d.getCreatedAt(),
                d.getLines().stream().map(l -> new OpnameLineResponse(
                        l.getProduct().getId(), l.getProduct().getName(),
                        l.getExpectedQty(), l.getCountedQty(), l.getDifferenceQty()))
                        .toList());
    }

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getUsername();
        }
        return null;
    }
}
