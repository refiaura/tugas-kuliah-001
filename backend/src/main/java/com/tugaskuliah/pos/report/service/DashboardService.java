package com.tugaskuliah.pos.report.service;

import com.tugaskuliah.pos.control.entity.Approval;
import com.tugaskuliah.pos.report.dto.DashboardResponse;
import com.tugaskuliah.pos.report.repository.ApprovalStatsRepository;
import com.tugaskuliah.pos.report.repository.CashReportRepository;
import com.tugaskuliah.pos.report.repository.PurchaseReportRepository;
import com.tugaskuliah.pos.report.repository.SaleReportRepository;
import com.tugaskuliah.pos.report.repository.StockReportRepository;
import com.tugaskuliah.pos.shift.entity.CashMovement;
import com.tugaskuliah.pos.shift.entity.CashierShift;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Dashboard KPIs (Milestone 8, PRD §24).
 * All figures are aggregated in the database; sales figures only count
 * COMPLETED (final) transactions.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    /** Variance above this (absolute) is reported as a shift-variance alert. */
    private static final BigDecimal VARIANCE_THRESHOLD = new BigDecimal("50000");

    private final SaleReportRepository saleReportRepository;
    private final StockReportRepository stockReportRepository;
    private final CashReportRepository cashReportRepository;
    private final PurchaseReportRepository purchaseReportRepository;
    private final ApprovalStatsRepository approvalStatsRepository;

    @Transactional(readOnly = true)
    public DashboardResponse dashboard() {
        ZoneId zone = ZoneId.systemDefault();
        OffsetDateTime startOfDay = LocalDate.now(zone).atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime endOfDay = startOfDay.plusDays(1);

        return new DashboardResponse(
                salesKpi(startOfDay, endOfDay),
                inventoryKpi(),
                cashKpi(startOfDay, endOfDay),
                alerts(startOfDay));
    }
    private DashboardResponse.SalesKpi salesKpi(OffsetDateTime start, OffsetDateTime end) {
        BigDecimal revenue = nvl(saleReportRepository.salesRevenue(start, end));
        long txCount = saleReportRepository.salesTxCount(start, end);
        BigDecimal itemsSold = nvl(saleReportRepository.itemsSold(start, end));
        BigDecimal avg = txCount == 0 ? BigDecimal.ZERO
                : revenue.divide(BigDecimal.valueOf(txCount), 2, RoundingMode.HALF_UP);
        BigDecimal cogs = nvl(saleReportRepository.cogs(start, end));
        BigDecimal grossProfit = revenue.subtract(cogs);
        return new DashboardResponse.SalesKpi(revenue, txCount, itemsSold, avg, grossProfit);
    }

    private DashboardResponse.InventoryKpi inventoryKpi() {
        return new DashboardResponse.InventoryKpi(
                stockReportRepository.countActiveSku(),
                stockReportRepository.countLowStock(),
                stockReportRepository.countOutOfStock(),
                nvl(stockReportRepository.stockValue()));
    }

    private DashboardResponse.CashKpi cashKpi(OffsetDateTime start, OffsetDateTime end) {
        List<CashierShift> openShifts =
                cashReportRepository.findByStatusOrderByOpenedAtDesc(CashierShift.Status.OPEN);
        BigDecimal totalCash = BigDecimal.ZERO;
        for (CashierShift s : openShifts) {
            totalCash = totalCash.add(expectedCash(s.getId(), s.getOpeningCash()));
        }
        return new DashboardResponse.CashKpi(
                totalCash,
                nvl(cashReportRepository.cashMovementSumByTypeAndDate(CashMovement.Type.IN, start, end)),
                nvl(cashReportRepository.cashMovementSumByTypeAndDate(CashMovement.Type.OUT, start, end)),
                openShifts.size(),
                cashReportRepository.countShiftsWithVariance(start, end, VARIANCE_THRESHOLD));
    }

    /** Expected cash for an open shift, same formula as shift close (M4). */
    private BigDecimal expectedCash(Long shiftId, BigDecimal openingCash) {
        BigDecimal sales = nvl(cashReportRepository.cashSalesByShift(shiftId));
        BigDecimal in = nvl(cashReportRepository.cashMovementSumByShift(shiftId, CashMovement.Type.IN));
        BigDecimal out = nvl(cashReportRepository.cashMovementSumByShift(shiftId, CashMovement.Type.OUT));
        BigDecimal refund = nvl(cashReportRepository.cashMovementSumByShift(shiftId, CashMovement.Type.REFUND));
        return nvl(openingCash).add(sales).add(in).subtract(out).subtract(refund);
    }

    private List<DashboardResponse.AlertItem> alerts(OffsetDateTime todayStart) {
        List<DashboardResponse.AlertItem> alerts = new ArrayList<>();

        long lowStock = stockReportRepository.countLowStock();
        long outOfStock = stockReportRepository.countOutOfStock();
        if (lowStock + outOfStock > 0) {
            var top = stockReportRepository.lowStockProducts(PageRequest.of(0, 3));
            String sample = top.isEmpty() ? "" : " (mis. " + top.get(0)[0] + ")";
            alerts.add(new DashboardResponse.AlertItem("LOW_STOCK",
                    (lowStock + outOfStock) + " produk stok menipis/habis" + sample,
                    lowStock + outOfStock));
        }

        long staleShifts = cashReportRepository.countStaleOpenShifts(todayStart.minusHours(12));
        if (staleShifts > 0) {
            alerts.add(new DashboardResponse.AlertItem("SHIFT_OPEN",
                    staleShifts + " shift terbuka lebih dari 12 jam", staleShifts));
        }

        long pendingApprovals = approvalStatsRepository.countByStatus(Approval.Status.PENDING);
        if (pendingApprovals > 0) {
            alerts.add(new DashboardResponse.AlertItem("PENDING_APPROVAL",
                    pendingApprovals + " pengajuan menunggu persetujuan", pendingApprovals));
        }

        long stalePos = purchaseReportRepository.countStaleDraftPos(todayStart.minusDays(7));
        if (stalePos > 0) {
            alerts.add(new DashboardResponse.AlertItem("PO_PENDING",
                    stalePos + " PO DRAFT lebih dari 7 hari belum diproses", stalePos));
        }

        return alerts;
    }

    private static BigDecimal nvl(Object v) {
        if (v == null) {
            return BigDecimal.ZERO;
        }
        if (v instanceof BigDecimal bd) {
            return bd;
        }
        if (v instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        return BigDecimal.ZERO;
    }
}
