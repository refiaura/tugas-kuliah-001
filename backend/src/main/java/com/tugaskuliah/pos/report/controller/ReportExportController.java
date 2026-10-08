package com.tugaskuliah.pos.report.controller;

import com.tugaskuliah.pos.purchase.entity.PurchaseOrder;
import com.tugaskuliah.pos.report.dto.CashReportRow;
import com.tugaskuliah.pos.report.dto.InventoryReportRow;
import com.tugaskuliah.pos.report.dto.ProductReportRow;
import com.tugaskuliah.pos.report.dto.ProfitReportResponse;
import com.tugaskuliah.pos.report.dto.PurchaseReportRow;
import com.tugaskuliah.pos.report.dto.SalesReportRow;
import com.tugaskuliah.pos.report.service.ReportExportService;
import com.tugaskuliah.pos.report.service.ReportExportService.Column;
import com.tugaskuliah.pos.report.service.ReportExportService.ExportResult;
import com.tugaskuliah.pos.report.service.ReportExportService.Format;
import com.tugaskuliah.pos.report.service.ReportService;
import com.tugaskuliah.pos.sales.entity.Sale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/**
 * Report file exports (XLSX / PDF / CSV).
 * Same data & permissions as the paginated report views; export fetches
 * all rows (unpaged).
 */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportExportController {

    private final ReportService reportService;
    private final ReportExportService exportService;

    @GetMapping("/sales/export")
    @PreAuthorize("hasAuthority('report.sales')")
    public ResponseEntity<byte[]> salesExport(
            @RequestParam(defaultValue = "xlsx") String format,
            @RequestParam(required = false) Sale.Status status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long cashierId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long paymentMethodId) {
        List<SalesReportRow> rows = reportService
                .sales(status, startDate, endDate, cashierId, customerId, paymentMethodId, Pageable.unpaged())
                .getContent();
        List<Column<SalesReportRow>> cols = List.of(
                Column.text("No. Invoice", SalesReportRow::invoiceNo),
                Column.text("Tanggal", r -> ReportExportService.fmtDateTime(r.completedAt())),
                Column.text("Kasir", SalesReportRow::cashierName),
                Column.text("Pelanggan", SalesReportRow::customerName),
                Column.money("Subtotal", SalesReportRow::subtotal),
                Column.money("Diskon", SalesReportRow::discountTotal),
                Column.money("Pajak", SalesReportRow::taxTotal),
                Column.money("Grand Total", SalesReportRow::grandTotal),
                Column.money("Dibayar", SalesReportRow::paidTotal),
                Column.text("Status", r -> String.valueOf(r.status())));
        ExportResult r = exportService.export("penjualan", "Laporan Penjualan",
                startDate, endDate, cols, rows, Format.from(format));
        return fileResponse(r);
    }

    @GetMapping("/products/export")
    @PreAuthorize("hasAuthority('report.sales')")
    public ResponseEntity<byte[]> productsExport(
            @RequestParam(defaultValue = "xlsx") String format,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<ProductReportRow> rows = reportService
                .products(startDate, endDate, Pageable.unpaged()).getContent();
        List<Column<ProductReportRow>> cols = List.of(
                Column.text("Produk", ProductReportRow::productName),
                Column.text("SKU", ProductReportRow::sku),
                Column.number("Qty Terjual", ProductReportRow::qtySold),
                Column.money("Omzet", ProductReportRow::revenue),
                Column.money("Diskon", ProductReportRow::discount),
                Column.number("Qty Retur", ProductReportRow::returnQty),
                Column.money("Penjualan Bersih", ProductReportRow::netSales));
        ExportResult r = exportService.export("produk", "Laporan Penjualan Produk",
                startDate, endDate, cols, rows, Format.from(format));
        return fileResponse(r);
    }

    @GetMapping("/inventory/export")
    @PreAuthorize("hasAuthority('report.stock')")
    public ResponseEntity<byte[]> inventoryExport(
            @RequestParam(defaultValue = "xlsx") String format,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<InventoryReportRow> rows = reportService
                .inventory(startDate, endDate, Pageable.unpaged()).getContent();
        List<Column<InventoryReportRow>> cols = List.of(
                Column.text("Produk", InventoryReportRow::productName),
                Column.text("SKU", InventoryReportRow::sku),
                Column.number("Stok Awal", InventoryReportRow::openingStock),
                Column.number("Masuk", InventoryReportRow::inQty),
                Column.number("Keluar", InventoryReportRow::outQty),
                Column.number("Penyesuaian", InventoryReportRow::adjustmentQty),
                Column.number("Stok Akhir", InventoryReportRow::currentStock));
        ExportResult r = exportService.export("stok", "Laporan Stok",
                startDate, endDate, cols, rows, Format.from(format));
        return fileResponse(r);
    }

    @GetMapping("/cash/export")
    @PreAuthorize("hasAuthority('report.cash')")
    public ResponseEntity<byte[]> cashExport(
            @RequestParam(defaultValue = "xlsx") String format,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long cashierId) {
        List<CashReportRow> rows = reportService
                .cash(startDate, endDate, cashierId, Pageable.unpaged()).getContent();
        List<Column<CashReportRow>> cols = List.of(
                Column.text("No. Shift", CashReportRow::shiftNo),
                Column.text("Kasir", CashReportRow::cashierName),
                Column.text("Dibuka", r -> ReportExportService.fmtDateTime(r.openedAt())),
                Column.text("Ditutup", r -> ReportExportService.fmtDateTime(r.closedAt())),
                Column.money("Kas Awal", CashReportRow::openingCash),
                Column.money("Penjualan Tunai", CashReportRow::cashSales),
                Column.money("Cash In", CashReportRow::cashIn),
                Column.money("Cash Out", CashReportRow::cashOut),
                Column.money("Refund", CashReportRow::cashRefund),
                Column.money("Kas Ekspektasi", CashReportRow::expectedCash),
                Column.money("Kas Aktual", CashReportRow::actualCash),
                Column.money("Selisih", CashReportRow::variance));
        ExportResult r = exportService.export("kas", "Laporan Kas",
                startDate, endDate, cols, rows, Format.from(format));
        return fileResponse(r);
    }

    @GetMapping("/purchases/export")
    @PreAuthorize("hasAuthority('report.purchase')")
    public ResponseEntity<byte[]> purchasesExport(
            @RequestParam(defaultValue = "xlsx") String format,
            @RequestParam(required = false) PurchaseOrder.Status status,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<PurchaseReportRow> rows = reportService
                .purchases(status, supplierId, startDate, endDate, Pageable.unpaged()).getContent();
        List<Column<PurchaseReportRow>> cols = List.of(
                Column.text("No. PO", PurchaseReportRow::poNumber),
                Column.text("Supplier", PurchaseReportRow::supplierName),
                Column.text("Tanggal", r -> ReportExportService.fmtDate(r.orderDate())),
                Column.money("Total", PurchaseReportRow::total),
                Column.text("Status Terima", PurchaseReportRow::receivedStatus),
                Column.text("Status Bayar", PurchaseReportRow::paymentStatus),
                Column.text("Status", r -> String.valueOf(r.status())));
        ExportResult r = exportService.export("pembelian", "Laporan Pembelian",
                startDate, endDate, cols, rows, Format.from(format));
        return fileResponse(r);
    }

    @GetMapping("/profit/export")
    @PreAuthorize("hasAuthority('report.profit')")
    public ResponseEntity<byte[]> profitExport(
            @RequestParam(defaultValue = "xlsx") String format,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        ProfitReportResponse p = reportService.profit(startDate, endDate);
        record ProfitLine(String label, java.math.BigDecimal value) {
        }
        List<ProfitLine> rows = List.of(
                new ProfitLine("Penjualan Bersih", p.netSales()),
                new ProfitLine("HPP", p.cogs()),
                new ProfitLine("Laba Kotor", p.grossProfit()));
        List<Column<ProfitLine>> cols = List.of(
                Column.text("Komponen", ProfitLine::label),
                Column.money("Nilai", ProfitLine::value));
        String title = "Laporan Laba" + (p.cogsEstimated() ? " (HPP estimasi)" : "");
        ExportResult r = exportService.export("laba", title,
                startDate, endDate, cols, rows, Format.from(format));
        return fileResponse(r);
    }

    // ------------------------------------------------------------------

    private ResponseEntity<byte[]> fileResponse(ExportResult r) {
        ContentDisposition cd = ContentDisposition.attachment()
                .filename(r.filename(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, cd.toString())
                .contentType(MediaType.parseMediaType(r.contentType()))
                .contentLength(r.bytes().length)
                .body(r.bytes());
    }
}
