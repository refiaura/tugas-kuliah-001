package com.tugaskuliah.pos.report.dto;

import java.math.BigDecimal;
import java.util.List;

/** Dashboard KPIs (Milestone 8, PRD §24). All money in BigDecimal. */
public record DashboardResponse(
        SalesKpi sales,
        InventoryKpi inventory,
        CashKpi cash,
        List<AlertItem> alerts) {

    public record SalesKpi(
            BigDecimal revenueToday,
            long transactionCount,
            BigDecimal itemsSold,
            BigDecimal averageTransactionValue,
            BigDecimal grossProfitToday) {
    }

    public record InventoryKpi(
            long totalActiveSku,
            long lowStockCount,
            long outOfStockCount,
            BigDecimal stockValue) {
    }

    public record CashKpi(
            BigDecimal totalCashActiveShifts,
            BigDecimal cashInToday,
            BigDecimal cashOutToday,
            long activeShiftCount,
            long shiftsWithVarianceToday) {
    }

    public record AlertItem(
            String type,
            String message,
            long count) {
    }
}
