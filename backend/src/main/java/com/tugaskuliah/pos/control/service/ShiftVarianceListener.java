package com.tugaskuliah.pos.control.service;

import com.tugaskuliah.pos.control.entity.Approval;
import com.tugaskuliah.pos.control.event.ShiftVarianceEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Creates a SHIFT_VARIANCE approval request for supervisor review when a
 * closed shift's |variance| exceeds the threshold. The shift stays closed —
 * it is never blocked (deferred M4 item, PRD §11.3).
 */
@Component
@RequiredArgsConstructor
public class ShiftVarianceListener {

    private final ApprovalService approvalService;
    private final AuditService auditService;

    // Regular @EventListener (not BEFORE_COMMIT): runs in the same transaction as
    // the publisher, so rollback still rolls back the approval. BEFORE_COMMIT
    // breaks @Transactional integration tests (they never commit).
    @EventListener
    public void onShiftVariance(ShiftVarianceEvent event) {
        String reason = "Selisih kas shift #" + event.shiftId() + ": expected "
                + event.expectedCash() + ", aktual " + event.actualCash()
                + ", variance " + event.variance();
        approvalService.request(Approval.SubjectType.SHIFT_VARIANCE, event.shiftId(), reason);
        auditService.log(event.cashierUsername(), "SHIFT_VARIANCE_FLAGGED", "SHIFT",
                event.shiftId(), null,
                Map.of("expectedCash", event.expectedCash().toString(),
                        "actualCash", event.actualCash().toString(),
                        "variance", event.variance().toString()));
    }
}
