package com.tugaskuliah.pos.purchase.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record PurchaseOrderResponse(
        Long id,
        String docNo,
        Long supplierId,
        String supplierName,
        String status,
        String notes,
        BigDecimal totalAmount,
        String createdBy,
        String approvedBy,
        OffsetDateTime approvedAt,
        OffsetDateTime createdAt,
        List<PoLineResponse> lines) {
}
