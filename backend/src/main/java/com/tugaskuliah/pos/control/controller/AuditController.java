package com.tugaskuliah.pos.control.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.control.dto.AuditLogResponse;
import com.tugaskuliah.pos.control.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Read-only audit log viewer. There is intentionally NO mutation endpoint —
 * audit_logs is append-only.
 */
@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping
    @PreAuthorize("hasAuthority('approval.view')")
    public ResponseEntity<ApiResponse<List<AuditLogResponse>>> list(
            @RequestParam(required = false) String entityType,
            @PageableDefault(size = 20) Pageable pageable) {
        var page = auditService.list(entityType, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Audit log",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }
}
