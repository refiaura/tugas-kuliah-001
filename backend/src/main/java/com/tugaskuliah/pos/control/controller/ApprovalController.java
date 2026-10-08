package com.tugaskuliah.pos.control.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.control.dto.ApprovalDecisionRequest;
import com.tugaskuliah.pos.control.dto.ApprovalResponse;
import com.tugaskuliah.pos.control.entity.Approval;
import com.tugaskuliah.pos.control.service.ApprovalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;

    @GetMapping
    @PreAuthorize("hasAuthority('approval.view')")
    public ResponseEntity<ApiResponse<List<ApprovalResponse>>> inbox(
            @RequestParam(required = false) Approval.Status status,
            @PageableDefault(size = 20) Pageable pageable) {
        var page = approvalService.inbox(status, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar pengajuan",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('approval.view')")
    public ResponseEntity<ApiResponse<ApprovalResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(approvalService.get(id), "Detail pengajuan"));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('approval.approve')")
    public ResponseEntity<ApiResponse<ApprovalResponse>> approve(
            @PathVariable Long id, @Valid @RequestBody(required = false) ApprovalDecisionRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                approvalService.decide(id, true, req), "Pengajuan disetujui"));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('approval.reject')")
    public ResponseEntity<ApiResponse<ApprovalResponse>> reject(
            @PathVariable Long id, @Valid @RequestBody(required = false) ApprovalDecisionRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                approvalService.decide(id, false, req), "Pengajuan ditolak"));
    }
}
