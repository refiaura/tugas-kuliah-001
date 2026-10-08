package com.tugaskuliah.pos.purchase.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.purchase.dto.*;
import com.tugaskuliah.pos.purchase.service.PurchaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Purchase module (Milestone 6): PO lifecycle, goods receipts,
 * purchase returns. Only receipts and returns touch stock.
 */
@RestController
@RequestMapping("/api/v1/purchases")
@RequiredArgsConstructor
public class PurchaseController {

    private final PurchaseService purchaseService;

    // ---------- purchase orders ----------

    @GetMapping("/orders")
    @PreAuthorize("hasAuthority('purchase.view')")
    public ResponseEntity<ApiResponse<java.util.List<PurchaseOrderResponse>>> listOrders(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<PurchaseOrderResponse> page = purchaseService.listOrders(status, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar purchase order",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @PostMapping("/orders")
    @PreAuthorize("hasAuthority('purchase.create')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> createOrder(
            @Valid @RequestBody PurchaseOrderRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(purchaseService.createOrder(req), "Purchase order dibuat (DRAFT)"));
    }

    @GetMapping("/orders/{id}")
    @PreAuthorize("hasAuthority('purchase.view')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> getOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(purchaseService.getOrder(id), "Detail purchase order"));
    }

    @PostMapping("/orders/{id}/submit")
    @PreAuthorize("hasAuthority('purchase.create')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> submit(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(purchaseService.submit(id), "PO di-submit untuk approval"));
    }

    @PostMapping("/orders/{id}/approve")
    @PreAuthorize("hasAuthority('purchase.approve')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> approve(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(purchaseService.approve(id), "PO di-approve"));
    }

    @PostMapping("/orders/{id}/mark-ordered")
    @PreAuthorize("hasAuthority('purchase.create')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> markOrdered(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(purchaseService.markOrdered(id), "PO dikirim ke supplier"));
    }

    @PostMapping("/orders/{id}/cancel")
    @PreAuthorize("hasAuthority('purchase.create')")
    public ResponseEntity<ApiResponse<PurchaseOrderResponse>> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(purchaseService.cancel(id), "PO dibatalkan"));
    }

    // ---------- goods receipts ----------

    @GetMapping("/receipts")
    @PreAuthorize("hasAuthority('purchase.view')")
    public ResponseEntity<ApiResponse<java.util.List<GoodsReceiptResponse>>> listReceipts(
            @RequestParam(required = false) Long poId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<GoodsReceiptResponse> page = purchaseService.listReceipts(poId, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar goods receipt",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @PostMapping("/receipts")
    @PreAuthorize("hasAuthority('purchase.receive')")
    public ResponseEntity<ApiResponse<GoodsReceiptResponse>> receive(
            @Valid @RequestBody GoodsReceiptRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(purchaseService.receive(req),
                        "Barang diterima; stok bertambah"));
    }

    // ---------- purchase returns ----------

    @GetMapping("/returns")
    @PreAuthorize("hasAuthority('purchase.view')")
    public ResponseEntity<ApiResponse<java.util.List<PurchaseReturnResponse>>> listReturns(
            @RequestParam(required = false) Long poId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<PurchaseReturnResponse> page = purchaseService.listReturns(poId, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar retur pembelian",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @PostMapping("/returns")
    @PreAuthorize("hasAuthority('purchase.return')")
    public ResponseEntity<ApiResponse<PurchaseReturnResponse>> createReturn(
            @Valid @RequestBody PurchaseReturnRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(purchaseService.createReturn(req),
                        "Retur tersimpan; stok berkurang, kredit supplier dicatat"));
    }
}
