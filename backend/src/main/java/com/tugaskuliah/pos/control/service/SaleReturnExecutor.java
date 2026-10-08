package com.tugaskuliah.pos.control.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.control.entity.Approval;
import com.tugaskuliah.pos.control.entity.SaleReturn;
import com.tugaskuliah.pos.control.entity.SaleReturnLine;
import com.tugaskuliah.pos.control.repository.SaleReturnRepository;
import com.tugaskuliah.pos.inventory.entity.InventoryBalance;
import com.tugaskuliah.pos.inventory.entity.StockMovement;
import com.tugaskuliah.pos.inventory.repository.InventoryBalanceRepository;
import com.tugaskuliah.pos.inventory.repository.StockMovementRepository;
import com.tugaskuliah.pos.shift.entity.CashMovement;
import com.tugaskuliah.pos.shift.entity.CashierShift;
import com.tugaskuliah.pos.shift.repository.CashMovementRepository;
import com.tugaskuliah.pos.shift.service.ShiftService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Executes an approved sale return (PRD §14):
 * - SELLABLE -> normal balance increases
 * - DAMAGED  -> damaged_qty bucket increases (not the normal balance)
 * - cash refund posted as a REFUND cash movement on the approver's open shift
 *   (refund needs an active shift, like checkout — M4 rule)
 * - sale_item.returned_qty tracked so partial returns stay consistent
 */
@Component
@RequiredArgsConstructor
public class SaleReturnExecutor implements ApprovalExecutor {

    private final SaleReturnRepository saleReturnRepository;
    private final StockMovementRepository movementRepository;
    private final InventoryBalanceRepository balanceRepository;
    private final CashMovementRepository cashMovementRepository;
    private final ShiftService shiftService;
    private final AuditService auditService;

    @Override
    public Approval.SubjectType subjectType() {
        return Approval.SubjectType.SALE_RETURN;
    }

    @Override
    public void execute(Approval approval) {
        SaleReturn ret = saleReturnRepository.findById(approval.getSubjectId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Retur tidak ditemukan"));
        if (ret.getStatus() != SaleReturn.Status.PENDING) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Retur sudah diproses");
        }
        String approver = approval.getDecidedBy();

        for (SaleReturnLine line : ret.getLines()) {
            InventoryBalance bal = balanceRepository.findByIdForUpdate(line.getProduct().getId())
                    .orElseGet(() -> {
                        InventoryBalance b = new InventoryBalance();
                        b.setProduct(line.getProduct());
                        b.setQty(BigDecimal.ZERO);
                        b.setDamagedQty(BigDecimal.ZERO);
                        return b;
                    });
            if (line.getCondition() == SaleReturnLine.Condition.SELLABLE) {
                bal.setQty(bal.getQty().add(line.getQty()));
            } else {
                bal.setDamagedQty(bal.getDamagedQty().add(line.getQty()));
            }
            bal.setUpdatedAt(OffsetDateTime.now());
            balanceRepository.save(bal);

            StockMovement m = new StockMovement();
            m.setProduct(line.getProduct());
            m.setQtyChange(line.getQty());
            m.setMovementType("SALE_RETURN");
            m.setReferenceType("SALE_RETURN");
            m.setReferenceId(ret.getId());
            m.setCreatedBy(approver);
            movementRepository.save(m);

            // track partial returns per sale item
            var item = line.getSaleItem();
            item.setReturnedQty(item.getReturnedQty().add(line.getQty()));
        }

        // cash refund on the approver's open shift (same rule as checkout).
        // Skip the cash movement when the refund is zero (free items) to
        // respect the chk_movement_amount > 0 constraint.
        if (ret.getRefundAmount().compareTo(BigDecimal.ZERO) > 0) {
            CashierShift shift = shiftService.requireOpenShift();
            CashMovement refund = new CashMovement();
            refund.setShift(shift);
            refund.setType(CashMovement.Type.REFUND);
            refund.setAmount(ret.getRefundAmount());
            refund.setReason("Refund retur penjualan " + ret.getReturnNo());
            refund.setReferenceNo(ret.getReturnNo());
            refund.setCreatedBy(approver);
            cashMovementRepository.save(refund);
            ret.setShift(shift);
        }
        ret.setStatus(SaleReturn.Status.COMPLETED);
        saleReturnRepository.save(ret);

        auditService.log(approver, "SALE_RETURN_EXECUTED", "SALE_RETURN", ret.getId(),
                Map.of("status", "PENDING"),
                Map.of("status", "COMPLETED", "refundAmount", ret.getRefundAmount().toString(),
                        "shiftId", String.valueOf(ret.getShift() != null ? ret.getShift().getId() : null)));
    }
}
