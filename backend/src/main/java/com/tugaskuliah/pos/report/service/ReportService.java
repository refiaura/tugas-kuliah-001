package com.tugaskuliah.pos.report.service;

import com.tugaskuliah.pos.purchase.entity.PurchaseOrder;
import com.tugaskuliah.pos.report.dto.CashReportRow;
import com.tugaskuliah.pos.report.dto.InventoryReportRow;
import com.tugaskuliah.pos.report.dto.ProductReportRow;
import com.tugaskuliah.pos.report.dto.ProfitReportResponse;
import com.tugaskuliah.pos.report.dto.PurchaseReportRow;
import com.tugaskuliah.pos.report.dto.SalesReportRow;
import com.tugaskuliah.pos.report.repository.CashReportRepository;
import com.tugaskuliah.pos.report.repository.PurchaseReportRepository;
import com.tugaskuliah.pos.report.repository.SaleReportRepository;
import com.tugaskuliah.pos.report.repository.StockReportRepository;
import com.tugaskuliah.pos.sales.entity.Sale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Paginated reports (Milestone 8, PRD §25).
 * Date filters are inclusive LocalDates, converted to [start, end) ranges.
 * Sales figures only count COMPLETED (final) transactions.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    private final SaleReportRepository saleReportRepository;
    private final StockReportRepository stockReportRepository;
    private final CashReportRepository cashReportRepository;
    private final PurchaseReportRepository purchaseReportRepository;

    @Transactional(readOnly = true)
    public Page<SalesReportRow> sales(Sale.Status status, LocalDate startDate, LocalDate endDate,
                                     Long cashierId, Long customerId, Long paymentMethodId,
                                     Pageable pageable) {
        // Default to COMPLETED (final transactions) when no status filter given.
        Sale.Status effectiveStatus = status == null ? Sale.Status.COMPLETED : status;
        return saleReportRepository.findSalesReport(effectiveStatus,
                toStart(startDate), toEndExclusive(endDate),
                cashierId, customerId, paymentMethodId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<ProductReportRow> products(LocalDate startDate, LocalDate endDate, Pageable pageable) {
        return saleReportRepository.findProductReport(toStart(startDate), toEndExclusive(endDate), pageable);
    }

    @Transactional(readOnly = true)
    public Page<InventoryReportRow> inventory(LocalDate startDate, LocalDate endDate, Pageable pageable) {
        return stockReportRepository.findInventoryReport(toStart(startDate), toEndExclusive(endDate), pageable);
    }

    @Transactional(readOnly = true)
    public Page<CashReportRow> cash(LocalDate startDate, LocalDate endDate, Long cashierId, Pageable pageable) {
        return cashReportRepository.findCashReport(toStart(startDate), toEndExclusive(endDate), cashierId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<PurchaseReportRow> purchases(PurchaseOrder.Status status, Long supplierId,
                                            LocalDate startDate, LocalDate endDate, Pageable pageable) {
        return purchaseReportRepository.findPurchaseReport(status, supplierId,
                toStart(startDate), toEndExclusive(endDate), pageable);
    }

    /**
     * Profit report (PRD §25.6): netSales = completed sales - completed
     * returns; cogs from product cost; grossProfit = netSales - cogs.
     */
    @Transactional(readOnly = true)
    public ProfitReportResponse profit(LocalDate startDate, LocalDate endDate) {
        // default to "all time" when no filter is given
        OffsetDateTime start = startDate == null
                ? OffsetDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC)
                : toStart(startDate);
        OffsetDateTime end = endDate == null ? OffsetDateTime.now() : toEndExclusive(endDate);
        BigDecimal grossSales = saleReportRepository.salesRevenue(start, end);
        if (grossSales == null) {
            grossSales = BigDecimal.ZERO;
        }
        BigDecimal returns = saleReportRepository.returnsTotal(start, end);
        BigDecimal netSales = grossSales.subtract(returns == null ? BigDecimal.ZERO : returns);
        BigDecimal cogs = saleReportRepository.cogs(start, end);
        if (cogs == null) {
            cogs = BigDecimal.ZERO;
        }
        boolean estimated = saleReportRepository.hasMissingCost(start, end);
        return new ProfitReportResponse(netSales, cogs, netSales.subtract(cogs), estimated);
    }

    private static OffsetDateTime toStart(LocalDate date) {
        return date == null ? null : date.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }

    private static OffsetDateTime toEndExclusive(LocalDate date) {
        return date == null ? null : date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
