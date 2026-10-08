package com.tugaskuliah.pos.report.dto;

import com.tugaskuliah.pos.purchase.entity.PurchaseOrder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** One row of the purchase report (PRD §25.5). */
public record PurchaseReportRow(
        String poNumber,
        String supplierName,
        OffsetDateTime orderDate,
        BigDecimal total,
        String receivedStatus,
        String paymentStatus,
        PurchaseOrder.Status status) {
}
