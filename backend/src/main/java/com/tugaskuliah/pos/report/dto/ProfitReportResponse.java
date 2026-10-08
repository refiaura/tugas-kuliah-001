package com.tugaskuliah.pos.report.dto;

import java.math.BigDecimal;

/**
 * Profit report (PRD §25.6).
 * {@code cogsEstimated} is true when any sold product in the period has no
 * usable cost (purchase price null or zero), so the COGS/gross profit figures
 * are estimates.
 */
public record ProfitReportResponse(
        BigDecimal netSales,
        BigDecimal cogs,
        BigDecimal grossProfit,
        boolean cogsEstimated) {
}
