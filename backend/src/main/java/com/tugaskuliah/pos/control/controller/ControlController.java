package com.tugaskuliah.pos.control.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.control.dto.*;
import com.tugaskuliah.pos.control.service.ControlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Void, return/refund requests and read-only audit log (Milestone 7).
 *
 * Permission note: V2 seeds sales.void/refund/return only for OWNER and
 * SUPERVISOR. A KASIR cannot hold those, but per PRD §13 the kasir is the
 * one who REQUESTS a void. So request endpoints use sales.create (kasir has
 * it); the DECISION stays in the approval inbox (approval.approve/reject,
 * supervisor/owner only). The underlying action (void/return) can never run
 * without an approval — there is no direct execution endpoint.
 */
@RestController
@RequestMapping("/api/v1/sales")
@RequiredArgsConstructor
public class ControlController {

    private final ControlService controlService;

    @PostMapping("/{id}/void")
    @PreAuthorize("hasAuthority('sales.create')")
    public ResponseEntity<ApiResponse<ApprovalResponse>> requestVoid(
            @PathVariable Long id, @Valid @RequestBody RequestVoidRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(controlService.requestVoid(id, req),
                        "Permintaan void dibuat, menunggu persetujuan"));
    }

    @PostMapping("/{id}/returns")
    @PreAuthorize("hasAuthority('sales.create')")
    public ResponseEntity<ApiResponse<SaleReturnResponse>> requestReturn(
            @PathVariable Long id, @Valid @RequestBody RequestReturnRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(controlService.requestReturn(id, req),
                        "Permintaan retur dibuat, menunggu persetujuan"));
    }

    @GetMapping("/{id}/returns")
    @PreAuthorize("hasAuthority('sales.view')")
    public ResponseEntity<ApiResponse<List<SaleReturnResponse>>> listReturns(
            @PathVariable Long id, @PageableDefault(size = 20) Pageable pageable) {
        var page = controlService.listReturns(id, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar retur",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/returns")
    @PreAuthorize("hasAuthority('sales.view')")
    public ResponseEntity<ApiResponse<List<SaleReturnResponse>>> listAllReturns(
            @PageableDefault(size = 20) Pageable pageable) {
        var page = controlService.listReturns(null, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar retur",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/returns/{returnId}")
    @PreAuthorize("hasAuthority('sales.view')")
    public ResponseEntity<ApiResponse<SaleReturnResponse>> getReturn(@PathVariable Long returnId) {
        return ResponseEntity.ok(ApiResponse.ok(controlService.getReturn(returnId), "Detail retur"));
    }
}
