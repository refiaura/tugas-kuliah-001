package com.tugaskuliah.pos.sales.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.sales.dto.*;
import com.tugaskuliah.pos.sales.entity.Sale;
import com.tugaskuliah.pos.sales.service.SaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/sales")
@RequiredArgsConstructor
public class SaleController {

    private final SaleService saleService;

    @GetMapping
    @PreAuthorize("hasAuthority('sales.view')")
    public ResponseEntity<ApiResponse<List<SaleResponse>>> list(
            @RequestParam(required = false) Sale.Status status,
            @PageableDefault(size = 20) Pageable pageable) {
        var page = saleService.list(status, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar transaksi",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('sales.view')")
    public ResponseEntity<ApiResponse<SaleResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(saleService.get(id), "Detail transaksi"));
    }

    @PostMapping("/checkout")
    @PreAuthorize("hasAuthority('sales.create')")
    public ResponseEntity<ApiResponse<SaleResponse>> checkout(@Valid @RequestBody CheckoutRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(saleService.checkout(req), "Transaksi berhasil"));
    }

    @PostMapping("/hold")
    @PreAuthorize("hasAuthority('sales.create')")
    public ResponseEntity<ApiResponse<SaleResponse>> hold(@Valid @RequestBody HoldRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(saleService.hold(req), "Transaksi di-hold"));
    }

    @PostMapping("/{id}/resume")
    @PreAuthorize("hasAuthority('sales.create')")
    public ResponseEntity<ApiResponse<SaleResponse>> resume(
            @PathVariable Long id, @Valid @RequestBody CheckoutRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(saleService.resumeAndCheckout(id, req), "Transaksi dilanjutkan"));
    }
}
