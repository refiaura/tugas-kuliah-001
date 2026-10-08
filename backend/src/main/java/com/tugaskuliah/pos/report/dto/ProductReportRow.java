package com.tugaskuliah.pos.report.dto;

import java.math.BigDecimal;

/** One row of the product sales report (PRD §25.2). */
public record ProductReportRow(
        String productName,
        String sku,
        BigDecimal qtySold,
        BigDecimal revenue,
        BigDecimal discount,
        BigDecimal returnQty,
        BigDecimal netSales) {
}
