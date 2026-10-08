package com.tugaskuliah.pos.inventory.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.inventory.dto.*;
import com.tugaskuliah.pos.inventory.service.StockService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Inventory documents. The movement ledger is read-only: there are
 * deliberately no write/delete endpoints for stock movements.
 */
@RestController
@RequestMapping("/api/v1/stock")
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;

    @GetMapping("/balances")
    @PreAuthorize("hasAuthority('stock.view')")
    public ResponseEntity<ApiResponse<java.util.List<StockBalanceResponse>>> balances() {
        return ResponseEntity.ok(ApiResponse.ok(stockService.balances(), "Saldo stok"));
    }

    @GetMapping("/movements")
    @PreAuthorize("hasAuthority('stock.view')")
    public ResponseEntity<ApiResponse<java.util.List<StockMovementResponse>>> movements(
            @RequestParam(required = false) Long productId,
            @PageableDefault(size = 50) Pageable pageable) {
        var page = stockService.movements(productId, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Riwayat pergerakan stok",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @PostMapping("/opnames")
    @PreAuthorize("hasAuthority('stock.opname')")
    public ResponseEntity<ApiResponse<OpnameResponse>> opname(@Valid @RequestBody OpnameRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(stockService.opname(req), "Opname tersimpan; selisih diterapkan"));
    }

    @PostMapping("/adjustments")
    @PreAuthorize("hasAuthority('stock.adjustment')")
    public ResponseEntity<ApiResponse<AdjustmentResponse>> adjustment(@Valid @RequestBody AdjustmentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(stockService.adjustment(req), "Adjustment tersimpan"));
    }

    @PostMapping("/transfers")
    @PreAuthorize("hasAuthority('stock.transfer')")
    public ResponseEntity<ApiResponse<TransferResponse>> transfer(@Valid @RequestBody TransferRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(stockService.transfer(req), "Transfer tersimpan"));
    }

    @PostMapping("/receipts")
    @PreAuthorize("hasAuthority('stock.receive')")
    public ResponseEntity<ApiResponse<ReceiptResponse>> receive(@Valid @RequestBody ReceiptRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(stockService.receive(req), "Penerimaan barang tersimpan"));
    }
}
