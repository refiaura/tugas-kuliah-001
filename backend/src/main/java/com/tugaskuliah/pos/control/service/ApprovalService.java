package com.tugaskuliah.pos.control.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.control.dto.ApprovalDecisionRequest;
import com.tugaskuliah.pos.control.dto.ApprovalResponse;
import com.tugaskuliah.pos.control.entity.Approval;
import com.tugaskuliah.pos.control.repository.ApprovalRepository;
import com.tugaskuliah.pos.control.repository.SaleReturnRepository;
import com.tugaskuliah.pos.report.service.NotificationService;
import com.tugaskuliah.pos.sales.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Generic approval workflow (Milestone 7):
 * request -> (approve | reject). The requester can NEVER decide their own
 * request (422, consistent with M6 anti-self-approve).
 * On APPROVED, the registered {@link ApprovalExecutor} for the subject type
 * runs the side effect (void, return) in the same transaction.
 */
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final ApprovalRepository approvalRepository;
    private final SaleRepository saleRepository;
    private final SaleReturnRepository saleReturnRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final List<ApprovalExecutor> executors;

    private Map<Approval.SubjectType, ApprovalExecutor> executorMap() {
        return executors.stream()
                .collect(Collectors.toMap(ApprovalExecutor::subjectType, Function.identity()));
    }

    @Transactional(readOnly = true)
    public Page<ApprovalResponse> inbox(Approval.Status status, Pageable pageable) {
        Page<Approval> page = status == null
                ? approvalRepository.findAllByOrderByCreatedAtDesc(pageable)
                : approvalRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
        return page.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ApprovalResponse get(Long id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ApprovalResponse request(Approval.SubjectType subjectType, Long subjectId, String reason) {
        String by = currentUsername();
        if (reason == null || reason.isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Alasan pengajuan wajib diisi");
        }
        if (approvalRepository.existsBySubjectTypeAndSubjectIdAndStatus(
                subjectType, subjectId, Approval.Status.PENDING)) {
            throw new ApiException(ErrorCode.CONFLICT,
                    "Sudah ada pengajuan pending untuk " + subjectType + " #" + subjectId);
        }
        Approval a = new Approval();
        a.setSubjectType(subjectType);
        a.setSubjectId(subjectId);
        a.setRequestedBy(by);
        a.setReason(reason);
        a.setStatus(Approval.Status.PENDING);
        Approval saved = approvalRepository.save(a);
        auditService.log(by, subjectType + "_REQUESTED", "APPROVAL", saved.getId(),
                null, Map.of("subjectId", subjectId, "reason", reason));
        // Milestone 8: notify approvers (best-effort)
        notificationService.notifyPendingApproval(saved);
        return toResponse(saved);
    }

    @Transactional
    public ApprovalResponse decide(Long id, boolean approve, ApprovalDecisionRequest req) {
        Approval a = findById(id);
        if (a.getStatus() != Approval.Status.PENDING) {
            throw new ApiException(ErrorCode.BUSINESS_ERROR, "Pengajuan sudah diputuskan");
        }
        String decider = currentUsername();
        if (decider != null && decider.equals(a.getRequestedBy())) {
            // same anti-self-approve rule as M6 PO approval
            throw new ApiException(ErrorCode.BUSINESS_ERROR,
                    "Pengaju tidak boleh menyetujui permintaannya sendiri");
        }
        a.setStatus(approve ? Approval.Status.APPROVED : Approval.Status.REJECTED);
        a.setDecidedBy(decider);
        a.setDecidedAt(OffsetDateTime.now());
        a.setDecisionNote(req != null ? req.decisionNote() : null);
        Approval saved = approvalRepository.save(a);
        auditService.log(decider, a.getSubjectType() + "_" + saved.getStatus(), "APPROVAL", saved.getId(),
                Map.of("status", "PENDING"),
                Map.of("status", saved.getStatus().name(), "decidedBy", decider));

        if (approve) {
            ApprovalExecutor executor = executorMap().get(a.getSubjectType());
            if (executor != null) {
                executor.execute(saved);
            }
        }
        return toResponse(saved);
    }

    private Approval findById(Long id) {
        return approvalRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Pengajuan tidak ditemukan"));
    }

    private String label(Approval a) {
        return switch (a.getSubjectType()) {
            case SALE_VOID -> saleRepository.findById(a.getSubjectId())
                    .map(s -> "Void " + s.getInvoiceNo()).orElse("Void sale #" + a.getSubjectId());
            case SALE_RETURN -> saleReturnRepository.findById(a.getSubjectId())
                    .map(r -> "Retur " + r.getReturnNo()).orElse("Retur #" + a.getSubjectId());
            case SHIFT_VARIANCE -> "Selisih shift #" + a.getSubjectId();
        };
    }

    private ApprovalResponse toResponse(Approval a) {
        return new ApprovalResponse(
                a.getId(), a.getSubjectType().name(), a.getSubjectId(), label(a),
                a.getRequestedBy(), a.getReason(), a.getStatus().name(),
                a.getDecidedBy(), a.getDecidedAt(), a.getDecisionNote(), a.getCreatedAt());
    }

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getUsername();
        }
        return null;
    }
}
