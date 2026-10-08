package com.tugaskuliah.pos.report.dto;

import java.math.BigDecimal;

/** One row of the inventory report (PRD §25.3), sourced from the movement ledger. */
public record InventoryReportRow(
        String productName,
        String sku,
        BigDecimal openingStock,
        BigDecimal inQty,
        BigDecimal outQty,
        BigDecimal adjustmentQty,
        BigDecimal currentStock) {
}
