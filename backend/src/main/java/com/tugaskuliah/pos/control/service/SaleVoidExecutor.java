package com.tugaskuliah.pos.control.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.control.entity.Approval;
import com.tugaskuliah.pos.inventory.entity.InventoryBalance;
import com.tugaskuliah.pos.inventory.entity.StockMovement;
import com.tugaskuliah.pos.inventory.repository.InventoryBalanceRepository;
import com.tugaskuliah.pos.inventory.repository.StockMovementRepository;
import com.tugaskuliah.pos.sales.entity.Sale;
import com.tugaskuliah.pos.sales.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Executes an approved void: marks the sale VOIDED, writes reversal stock
 * movements (the exact inverse of the original SALE movements), and audits.
 * The sale row itself is never deleted (PRD §5.1).
 */
@Component
@RequiredArgsConstructor
public class SaleVoidExecutor implements ApprovalExecutor {

    private final SaleRepository saleRepository;
    private final StockMovementRepository movementRepository;
    private final InventoryBalanceRepository balanceRepository;
    private final AuditService auditService;

    @Override
    public Approval.SubjectType subjectType() {
        return Approval.SubjectType.SALE_VOID;
    }

    @Override
    public void execute(Approval approval) {
        Sale sale = saleRepository.findById(approval.getSubjectId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Transaksi tidak ditemukan"));
        if (sale.getStatus() != Sale.Status.COMPLETED) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Hanya transaksi COMPLETED yang bisa di-void (status: " + sale.getStatus() + ")");
        }

        // reverse every original SALE stock movement (pessimistic lock, atomic)
        List<StockMovement> originals = movementRepository
                .findByMovementTypeAndReferenceTypeAndReferenceId("SALE", "SALE", sale.getId());
        for (StockMovement orig : originals) {
            InventoryBalance bal = balanceRepository.findByIdForUpdate(orig.getProduct().getId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Stok produk tidak ditemukan"));
            bal.setQty(bal.getQty().subtract(orig.getQtyChange())); // original is negative -> adds back
            bal.setUpdatedAt(OffsetDateTime.now());
            balanceRepository.save(bal);

            StockMovement reversal = new StockMovement();
            reversal.setProduct(orig.getProduct());
            reversal.setVariant(orig.getVariant());
            reversal.setQtyChange(orig.getQtyChange().negate());
            reversal.setMovementType("VOID");
            reversal.setReferenceType("SALE_VOID");
            reversal.setReferenceId(sale.getId());
            reversal.setCreatedBy(approval.getDecidedBy());
            movementRepository.save(reversal);
        }

        sale.setStatus(Sale.Status.VOIDED);
        sale.setVoidedAt(OffsetDateTime.now());
        sale.setVoidedBy(approval.getDecidedBy());
        sale.setVoidReason(approval.getReason());
        saleRepository.save(sale);

        auditService.log(approval.getDecidedBy(), "SALE_VOID_EXECUTED", "SALE", sale.getId(),
                Map.of("status", "COMPLETED"),
                Map.of("status", "VOIDED", "approvalId", approval.getId()));
    }
}
