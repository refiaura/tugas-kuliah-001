package com.tugaskuliah.pos.control.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.control.dto.*;
import com.tugaskuliah.pos.control.entity.Approval;
import com.tugaskuliah.pos.control.entity.SaleReturn;
import com.tugaskuliah.pos.control.entity.SaleReturnLine;
import com.tugaskuliah.pos.control.repository.ApprovalRepository;
import com.tugaskuliah.pos.control.repository.SaleReturnRepository;
import com.tugaskuliah.pos.inventory.entity.DocumentCounter;
import com.tugaskuliah.pos.inventory.repository.DocumentCounterRepository;
import com.tugaskuliah.pos.sales.entity.Sale;
import com.tugaskuliah.pos.sales.entity.SaleItem;
import com.tugaskuliah.pos.sales.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Void & return request flows (Milestone 7).
 * A kasir (sales.create) creates a REQUEST; a supervisor (approval.approve)
 * decides it via the generic approval inbox. Direct void/return without
 * approval is not possible (PRD §13).
 */
@Service
@RequiredArgsConstructor
public class ControlService {

    private final SaleRepository saleRepository;
    private final SaleReturnRepository saleReturnRepository;
    private final ApprovalRepository approvalRepository;
    private final ApprovalService approvalService;
    private final DocumentCounterRepository counterRepository;
    private final AuditService auditService;

    // ---------- void ----------

    @Transactional
    public ApprovalResponse requestVoid(Long saleId, RequestVoidRequest req) {
        Sale sale = findCompletedSale(saleId);
        return approvalService.request(Approval.SubjectType.SALE_VOID, sale.getId(), req.reason());
    }

    // ---------- return ----------

    @Transactional
    public SaleReturnResponse requestReturn(Long saleId, RequestReturnRequest req) {
        Sale sale = findCompletedSale(saleId);
        String by = currentUsername();

        // build draft return + validate lines
        SaleReturn ret = new SaleReturn();
        ret.setReturnNo(nextReturnNo());
        ret.setSale(sale);
        ret.setReason(req.reason());
        ret.setStatus(SaleReturn.Status.PENDING);
        ret.setCreatedBy(by);

        BigDecimal refundTotal = BigDecimal.ZERO;
        for (var lineReq : req.lines()) {
            SaleItem item = sale.getItems().stream()
                    .filter(i -> i.getId().equals(lineReq.saleItemId()))
                    .findFirst()
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND,
                            "Item transaksi tidak ditemukan: " + lineReq.saleItemId()));
            SaleReturnLine.Condition cond;
            try {
                cond = SaleReturnLine.Condition.valueOf(lineReq.condition());
            } catch (IllegalArgumentException e) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR,
                        "Kondisi harus SELLABLE atau DAMAGED");
            }
            BigDecimal available = item.getQty().subtract(item.getReturnedQty());
            if (lineReq.qty().compareTo(available) > 0) {
                throw new ApiException(ErrorCode.BUSINESS_ERROR,
                        "Qty retur " + lineReq.qty() + " melebihi sisa terjual " + available
                                + " untuk " + item.getName());
            }
            // proportional discount on the returned qty
            BigDecimal unitDiscount = item.getQty().compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO
                    : item.getDiscount().multiply(lineReq.qty())
                            .divide(item.getQty(), 2, RoundingMode.HALF_UP);
            BigDecimal lineRefund = lineReq.qty().multiply(item.getUnitPrice()).subtract(unitDiscount);
            if (lineRefund.compareTo(BigDecimal.ZERO) < 0) {
                lineRefund = BigDecimal.ZERO;
            }

            SaleReturnLine line = new SaleReturnLine();
            line.setSaleReturn(ret);
            line.setSaleItem(item);
            line.setProduct(item.getProduct());
            line.setQty(lineReq.qty());
            line.setUnitPrice(item.getUnitPrice());
            line.setLineDiscount(unitDiscount);
            line.setCondition(cond);
            ret.getLines().add(line);
            refundTotal = refundTotal.add(lineRefund);
        }
        ret.setRefundAmount(refundTotal);
        SaleReturn saved = saleReturnRepository.save(ret);

        // approval request for this return (must be approved before execution)
        ApprovalResponse approval = approvalService.request(
                Approval.SubjectType.SALE_RETURN, saved.getId(), req.reason());
        saved.setApproval(approvalRepository.getReferenceById(approval.id()));
        saleReturnRepository.save(saved);

        auditService.log(by, "SALE_RETURN_REQUESTED", "SALE_RETURN", saved.getId(),
                null, java.util.Map.of("saleId", saleId, "refundAmount", refundTotal.toString()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<SaleReturnResponse> listReturns(Long saleId, Pageable pageable) {
        Page<SaleReturn> page = saleId == null
                ? saleReturnRepository.findAllByOrderByCreatedAtDesc(pageable)
                : saleReturnRepository.findBySaleIdOrderByCreatedAtDesc(saleId, pageable);
        return page.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public SaleReturnResponse getReturn(Long id) {
        return toResponse(saleReturnRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Retur tidak ditemukan")));
    }

    // ---------- helpers ----------

    private Sale findCompletedSale(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Transaksi tidak ditemukan"));
        if (sale.getStatus() != Sale.Status.COMPLETED) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Hanya transaksi COMPLETED yang bisa di-void/retur (status: " + sale.getStatus() + ")");
        }
        return sale;
    }

    private String nextReturnNo() {
        LocalDate today = LocalDate.now();
        DocumentCounter.Pk pk = new DocumentCounter.Pk("SR", today);
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
        return "SR-" + today.format(DateTimeFormatter.BASIC_ISO_DATE)
                + "-" + String.format("%06d", next);
    }

    private SaleReturnResponse toResponse(SaleReturn r) {
        return new SaleReturnResponse(
                r.getId(), r.getReturnNo(), r.getSale().getId(), r.getSale().getInvoiceNo(),
                r.getApproval() != null ? r.getApproval().getId() : null,
                r.getReason(), r.getRefundAmount(),
                r.getShift() != null ? r.getShift().getId() : null,
                r.getStatus().name(), r.getCreatedBy(), r.getCreatedAt(),
                r.getLines().stream().map(l -> new ReturnLineResponse(
                        l.getSaleItem().getId(), l.getProduct().getName(),
                        l.getQty(), l.getUnitPrice(), l.getLineDiscount(),
                        l.getCondition().name())).toList());
    }

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getUsername();
        }
        return null;
    }
}
