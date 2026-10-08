package com.tugaskuliah.pos.purchase.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.inventory.entity.DocumentCounter;
import com.tugaskuliah.pos.inventory.entity.InventoryBalance;
import com.tugaskuliah.pos.inventory.entity.StockMovement;
import com.tugaskuliah.pos.inventory.repository.DocumentCounterRepository;
import com.tugaskuliah.pos.inventory.repository.InventoryBalanceRepository;
import com.tugaskuliah.pos.inventory.repository.StockMovementRepository;
import com.tugaskuliah.pos.masterdata.entity.Product;
import com.tugaskuliah.pos.masterdata.entity.Supplier;
import com.tugaskuliah.pos.masterdata.repository.ProductRepository;
import com.tugaskuliah.pos.masterdata.repository.SupplierRepository;
import com.tugaskuliah.pos.purchase.dto.*;
import com.tugaskuliah.pos.purchase.entity.*;
import com.tugaskuliah.pos.purchase.repository.*;
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
 * Purchase flow (Milestone 6, PRD §21).
 *
 * Every write is ONE atomic transaction. Stock is touched ONLY by
 * goods receipts (PURCHASE, stock in) and purchase returns
 * (PURCHASE_RETURN, stock out) — a purchase order itself never changes
 * stock. Balances are locked pessimistically before update.
 *
 * Lifecycle: DRAFT → SUBMITTED → APPROVED → ORDERED
 *   → PARTIALLY_RECEIVED → RECEIVED; CANCELLED from DRAFT/SUBMITTED.
 * Approval requires purchase.approve AND forbids self-approval
 * (requester may not approve their own PO — foreshadows Milestone 7).
 */
@Service
@RequiredArgsConstructor
public class PurchaseService {

    private final PurchaseOrderRepository orderRepository;
    private final GoodsReceiptRepository receiptRepository;
    private final GoodsReceiptLineRepository receiptLineRepository;
    private final PurchaseReturnRepository returnRepository;
    private final PurchaseReturnLineRepository returnLineRepository;

    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final InventoryBalanceRepository balanceRepository;
    private final StockMovementRepository movementRepository;
    private final DocumentCounterRepository counterRepository;

    // ---------- reads ----------

    @Transactional(readOnly = true)
    public Page<PurchaseOrderResponse> listOrders(String status, Pageable pageable) {
        Page<PurchaseOrder> page;
        if (status == null || status.isBlank()) {
            page = orderRepository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            PurchaseOrder.Status s = parseStatus(status);
            page = orderRepository.findByStatusOrderByCreatedAtDesc(s, pageable);
        }
        return page.map(this::toOrderResponse);
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse getOrder(Long id) {
        return toOrderResponse(findOrder(id));
    }

    @Transactional(readOnly = true)
    public Page<GoodsReceiptResponse> listReceipts(Long poId, Pageable pageable) {
        Page<GoodsReceipt> page = poId == null
                ? receiptRepository.findAll(pageable)
                : receiptRepository.findByPurchaseOrderIdOrderByCreatedAtDesc(poId, pageable);
        return page.map(this::toReceiptResponse);
    }

    @Transactional(readOnly = true)
    public Page<PurchaseReturnResponse> listReturns(Long poId, Pageable pageable) {
        Page<PurchaseReturn> page = poId == null
                ? returnRepository.findAll(pageable)
                : returnRepository.findByPurchaseOrderIdOrderByCreatedAtDesc(poId, pageable);
        return page.map(this::toReturnResponse);
    }

    // ---------- PO lifecycle ----------

    /** Create a new PO in DRAFT status. Never touches stock. */
    @Transactional
    public PurchaseOrderResponse createOrder(PurchaseOrderRequest req) {
        Supplier supplier = findActiveSupplier(req.supplierId());

        PurchaseOrder po = new PurchaseOrder();
        po.setDocNo(nextDocNo("PO", "PO-"));
        po.setSupplier(supplier);
        po.setStatus(PurchaseOrder.Status.DRAFT);
        po.setNotes(req.notes());
        po.setCreatedBy(currentUsername());

        BigDecimal total = BigDecimal.ZERO;
        for (var lineReq : req.lines()) {
            Product p = findActiveProduct(lineReq.productId());
            PurchaseOrderLine line = new PurchaseOrderLine();
            line.setOrder(po);
            line.setProduct(p);
            line.setQty(lineReq.qty());
            line.setUnitPrice(lineReq.unitPrice());
            po.getLines().add(line);
            total = total.add(lineReq.qty().multiply(lineReq.unitPrice()));
        }
        po.setTotalAmount(total);
        return toOrderResponse(orderRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse submit(Long id) {
        PurchaseOrder po = findOrder(id);
        requireStatus(po, PurchaseOrder.Status.DRAFT, "submit");
        po.setStatus(PurchaseOrder.Status.SUBMITTED);
        return toOrderResponse(orderRepository.save(po));
    }

    @Transactional
    public PurchaseOrderResponse approve(Long id) {
        PurchaseOrder po = findOrder(id);
        requireStatus(po, PurchaseOrder.Status.SUBMITTED, "approve");
        String approver = currentUsername();
        if (po.getCreatedBy() != null && po.getCreatedBy().equals(approver)) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "PO tidak boleh di-approve oleh pembuatnya sendiri (" + approver + ")");
        }
        po.setStatus(PurchaseOrder.Status.APPROVED);
        po.setApprovedBy(approver);
        po.setApprovedAt(OffsetDateTime.now());
        return toOrderResponse(orderRepository.save(po));
    }

    /** Mark an approved PO as sent to the supplier. */
    @Transactional
    public PurchaseOrderResponse markOrdered(Long id) {
        PurchaseOrder po = findOrder(id);
        requireStatus(po, PurchaseOrder.Status.APPROVED, "tandai terkirim ke supplier");
        po.setStatus(PurchaseOrder.Status.ORDERED);
        return toOrderResponse(orderRepository.save(po));
    }

    /** Cancel only before approval. Approved/received POs cannot be cancelled. */
    @Transactional
    public PurchaseOrderResponse cancel(Long id) {
        PurchaseOrder po = findOrder(id);
        if (po.getStatus() != PurchaseOrder.Status.DRAFT
                && po.getStatus() != PurchaseOrder.Status.SUBMITTED) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "PO dengan status " + po.getStatus() + " tidak dapat dibatalkan");
        }
        po.setStatus(PurchaseOrder.Status.CANCELLED);
        return toOrderResponse(orderRepository.save(po));
    }

    // ---------- goods receipt ----------

    /**
     * Receive goods (partial supported). Posts PURCHASE stock movements
     * and updates balances atomically; advances the PO status.
     */
    @Transactional
    public GoodsReceiptResponse receive(GoodsReceiptRequest req) {
        PurchaseOrder po = findOrder(req.poId());
        if (po.getStatus() != PurchaseOrder.Status.ORDERED
                && po.getStatus() != PurchaseOrder.Status.PARTIALLY_RECEIVED) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "PO " + po.getDocNo() + " belum bisa diterima (status " + po.getStatus() + ")");
        }

        GoodsReceipt receipt = new GoodsReceipt();
        receipt.setDocNo(nextDocNo("GR", "GR-"));
        receipt.setPurchaseOrder(po);
        receipt.setNotes(req.notes());
        receipt.setCreatedBy(currentUsername());
        GoodsReceipt saved = receiptRepository.save(receipt);

        for (var lineReq : req.lines()) {
            PurchaseOrderLine poLine = findOrderLineOf(po, lineReq.poLineId());
            BigDecimal receivedSoFar = receiptLineRepository.sumReceivedByPoLineId(poLine.getId());
            BigDecimal after = receivedSoFar.add(lineReq.receivedQty());
            if (after.compareTo(poLine.getQty()) > 0) {
                throw new ApiException(ErrorCode.BUSINESS_ERROR,
                        "Qty terima (" + after + ") melebihi qty order ("
                                + poLine.getQty() + ") untuk " + poLine.getProduct().getName());
            }

            // stock in
            Product p = poLine.getProduct();
            InventoryBalance bal = lockBalance(p);
            bal.setQty(bal.getQty().add(lineReq.receivedQty()));
            bal.setUpdatedAt(OffsetDateTime.now());
            movement(p, lineReq.receivedQty(), "PURCHASE", null, "GOODS_RECEIPT", saved.getId());

            GoodsReceiptLine line = new GoodsReceiptLine();
            line.setReceipt(saved);
            line.setPoLine(poLine);
            line.setProduct(p);
            line.setReceivedQty(lineReq.receivedQty());
            saved.getLines().add(line);
        }

        // advance PO status: fully received → RECEIVED, else PARTIALLY_RECEIVED
        boolean fullyReceived = po.getLines().stream()
                .allMatch(l -> receiptLineRepository.sumReceivedByPoLineId(l.getId())
                        .compareTo(l.getQty()) >= 0);
        po.setStatus(fullyReceived
                ? PurchaseOrder.Status.RECEIVED
                : PurchaseOrder.Status.PARTIALLY_RECEIVED);
        orderRepository.save(po);

        return toReceiptResponse(receiptRepository.save(saved));
    }

    // ---------- purchase return ----------

    /**
     * Return goods to the supplier: stock out + supplier credit.
     * May never return more than received-minus-returned per PO line.
     */
    @Transactional
    public PurchaseReturnResponse createReturn(PurchaseReturnRequest req) {
        PurchaseOrder po = findOrder(req.poId());
        if (po.getStatus() != PurchaseOrder.Status.ORDERED
                && po.getStatus() != PurchaseOrder.Status.PARTIALLY_RECEIVED
                && po.getStatus() != PurchaseOrder.Status.RECEIVED) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Retur hanya untuk PO yang sudah menerima barang (status " + po.getStatus() + ")");
        }

        PurchaseReturn ret = new PurchaseReturn();
        ret.setDocNo(nextDocNo("PR", "PR-"));
        ret.setPurchaseOrder(po);
        ret.setReason(req.reason().trim());
        ret.setCreatedBy(currentUsername());
        PurchaseReturn saved = returnRepository.save(ret);

        BigDecimal credit = BigDecimal.ZERO;
        for (var lineReq : req.lines()) {
            PurchaseOrderLine poLine = findOrderLineOf(po, lineReq.poLineId());
            BigDecimal received = receiptLineRepository.sumReceivedByPoLineId(poLine.getId());
            BigDecimal returnedSoFar = returnLineRepository.sumReturnedByPoLineId(poLine.getId());
            BigDecimal available = received.subtract(returnedSoFar);
            if (lineReq.qty().compareTo(available) > 0) {
                throw new ApiException(ErrorCode.BUSINESS_ERROR,
                        "Qty retur (" + lineReq.qty() + ") melebihi qty tersedia untuk diretur ("
                                + available + ") pada " + poLine.getProduct().getName());
            }

            // stock out (never negative)
            Product p = poLine.getProduct();
            InventoryBalance bal = lockBalance(p);
            BigDecimal after = bal.getQty().subtract(lineReq.qty());
            if (after.compareTo(BigDecimal.ZERO) < 0) {
                throw new ApiException(ErrorCode.BUSINESS_ERROR,
                        "Retur membuat stok negatif untuk " + p.getName()
                                + " (tersedia " + bal.getQty() + ")");
            }
            bal.setQty(after);
            bal.setUpdatedAt(OffsetDateTime.now());
            movement(p, lineReq.qty().negate(), "PURCHASE_RETURN", null,
                    "PURCHASE_RETURN", saved.getId());

            PurchaseReturnLine line = new PurchaseReturnLine();
            line.setPurchaseReturn(saved);
            line.setPoLine(poLine);
            line.setProduct(p);
            line.setQty(lineReq.qty());
            saved.getLines().add(line);

            credit = credit.add(lineReq.qty().multiply(poLine.getUnitPrice()));
        }
        saved.setSupplierCredit(credit);
        return toReturnResponse(returnRepository.save(saved));
    }

    // ---------- helpers ----------

    private PurchaseOrder findOrder(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Purchase order tidak ditemukan"));
    }

    private PurchaseOrderLine findOrderLineOf(PurchaseOrder po, Long poLineId) {
        return po.getLines().stream()
                .filter(l -> l.getId().equals(poLineId))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.BUSINESS_ERROR,
                        "Baris PO #" + poLineId + " bukan bagian dari PO " + po.getDocNo()));
    }

    private void requireStatus(PurchaseOrder po, PurchaseOrder.Status expected, String action) {
        if (po.getStatus() != expected) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Tidak bisa " + action + ": status PO " + po.getStatus()
                            + " (diperlukan " + expected + ")");
        }
    }

    private PurchaseOrder.Status parseStatus(String s) {
        try {
            return PurchaseOrder.Status.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Status PO tidak dikenal: " + s);
        }
    }

    private Supplier findActiveSupplier(Long id) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Supplier tidak ditemukan"));
        if (!s.isActive()) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Supplier nonaktif: " + s.getName());
        }
        return s;
    }

    private Product findActiveProduct(Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Produk tidak ditemukan"));
        if (!p.isActive()) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Produk nonaktif: " + p.getName());
        }
        return p;
    }

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
     * Concurrent-safe document numbering: PO-/GR-/PR-YYYYMMDD-000001.
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
        int next = counter.getLastNumber() + 1;
        counter.setLastNumber(next);
        counterRepository.save(counter);
        return prefix + today.format(DateTimeFormatter.BASIC_ISO_DATE)
                + "-" + String.format("%06d", next);
    }

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getUsername();
        }
        return null;
    }

    // ---------- mapping ----------

    private PurchaseOrderResponse toOrderResponse(PurchaseOrder po) {
        List<PoLineResponse> lines = po.getLines().stream()
                .map(l -> new PoLineResponse(
                        l.getId(),
                        l.getProduct().getId(),
                        l.getProduct().getName(),
                        l.getQty(),
                        l.getUnitPrice(),
                        l.getQty().multiply(l.getUnitPrice()),
                        receiptLineRepository.sumReceivedByPoLineId(l.getId()),
                        returnLineRepository.sumReturnedByPoLineId(l.getId())))
                .toList();
        return new PurchaseOrderResponse(
                po.getId(), po.getDocNo(),
                po.getSupplier().getId(), po.getSupplier().getName(),
                po.getStatus().name(), po.getNotes(), po.getTotalAmount(),
                po.getCreatedBy(), po.getApprovedBy(), po.getApprovedAt(),
                po.getCreatedAt(), lines);
    }

    private GoodsReceiptResponse toReceiptResponse(GoodsReceipt r) {
        List<GrLineResponse> lines = r.getLines().stream()
                .map(l -> new GrLineResponse(
                        l.getId(), l.getPoLine().getId(),
                        l.getProduct().getId(), l.getProduct().getName(),
                        l.getReceivedQty()))
                .toList();
        return new GoodsReceiptResponse(
                r.getId(), r.getDocNo(),
                r.getPurchaseOrder().getId(), r.getPurchaseOrder().getDocNo(),
                r.getNotes(), r.getCreatedBy(), r.getCreatedAt(), lines);
    }

    private PurchaseReturnResponse toReturnResponse(PurchaseReturn r) {
        List<PrLineResponse> lines = r.getLines().stream()
                .map(l -> new PrLineResponse(
                        l.getId(), l.getPoLine().getId(),
                        l.getProduct().getId(), l.getProduct().getName(),
                        l.getQty(), l.getPoLine().getUnitPrice(),
                        l.getQty().multiply(l.getPoLine().getUnitPrice())))
                .toList();
        return new PurchaseReturnResponse(
                r.getId(), r.getDocNo(),
                r.getPurchaseOrder().getId(), r.getPurchaseOrder().getDocNo(),
                r.getReason(), r.getSupplierCredit(),
                r.getCreatedBy(), r.getCreatedAt(), lines);
    }
}
