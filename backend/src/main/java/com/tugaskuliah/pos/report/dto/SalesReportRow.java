package com.tugaskuliah.pos.report.dto;

import com.tugaskuliah.pos.sales.entity.Sale;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** One row of the sales report (PRD §25.1). */
public record SalesReportRow(
        String invoiceNo,
        OffsetDateTime completedAt,
        String cashierName,
        String customerName,
        BigDecimal subtotal,
        BigDecimal discountTotal,
        BigDecimal taxTotal,
        BigDecimal grandTotal,
        BigDecimal paidTotal,
        Sale.Status status) {
}
