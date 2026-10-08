package com.tugaskuliah.pos.control.service;

import com.tugaskuliah.pos.control.entity.Approval;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Executes an approved shift-variance review. The shift is already closed —
 * the approval only records that a supervisor reviewed the variance.
 */
@Component
@RequiredArgsConstructor
public class ShiftVarianceExecutor implements ApprovalExecutor {

    private final AuditService auditService;

    @Override
    public Approval.SubjectType subjectType() {
        return Approval.SubjectType.SHIFT_VARIANCE;
    }

    @Override
    public void execute(Approval approval) {
        auditService.log(approval.getDecidedBy(), "SHIFT_VARIANCE_REVIEWED", "SHIFT",
                approval.getSubjectId(),
                Map.of("status", "PENDING"),
                Map.of("status", "REVIEWED", "approvalId", approval.getId()));
    }
}
