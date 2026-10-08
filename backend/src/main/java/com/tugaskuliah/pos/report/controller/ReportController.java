package com.tugaskuliah.pos.report.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.purchase.entity.PurchaseOrder;
import com.tugaskuliah.pos.report.dto.*;
import com.tugaskuliah.pos.report.service.ReportService;
import com.tugaskuliah.pos.sales.entity.Sale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * Paginated reports (Milestone 8, PRD §25).
 * Date filters are inclusive ISO dates (yyyy-MM-dd).
 */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/sales")
    @PreAuthorize("hasAuthority('report.sales')")
    public ResponseEntity<ApiResponse<java.util.List<SalesReportRow>>> sales(
            @RequestParam(required = false) Sale.Status status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long cashierId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long paymentMethodId,
            @PageableDefault(size = 50) Pageable pageable) {
        var page = reportService.sales(status, startDate, endDate, cashierId, customerId, paymentMethodId, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Laporan penjualan",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/products")
    @PreAuthorize("hasAuthority('report.sales')")
    public ResponseEntity<ApiResponse<java.util.List<ProductReportRow>>> products(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @PageableDefault(size = 50) Pageable pageable) {
        var page = reportService.products(startDate, endDate, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Laporan penjualan produk",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/inventory")
    @PreAuthorize("hasAuthority('report.stock')")
    public ResponseEntity<ApiResponse<java.util.List<InventoryReportRow>>> inventory(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @PageableDefault(size = 50) Pageable pageable) {
        var page = reportService.inventory(startDate, endDate, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Laporan stok",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/cash")
    @PreAuthorize("hasAuthority('report.cash')")
    public ResponseEntity<ApiResponse<java.util.List<CashReportRow>>> cash(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long cashierId,
            @PageableDefault(size = 50) Pageable pageable) {
        var page = reportService.cash(startDate, endDate, cashierId, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Laporan kas",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/purchases")
    @PreAuthorize("hasAuthority('report.purchase')")
    public ResponseEntity<ApiResponse<java.util.List<PurchaseReportRow>>> purchases(
            @RequestParam(required = false) PurchaseOrder.Status status,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @PageableDefault(size = 50) Pageable pageable) {
        var page = reportService.purchases(status, supplierId, startDate, endDate, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Laporan pembelian",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/profit")
    @PreAuthorize("hasAuthority('report.profit')")
    public ResponseEntity<ApiResponse<ProfitReportResponse>> profit(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(ApiResponse.ok(reportService.profit(startDate, endDate), "Laporan laba"));
    }
}
