package com.tugaskuliah.pos.inventory.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ReceiptResponse(
        Long id,
        String docNo,
        Long productId,
        String productName,
        BigDecimal qty,
        String location,
        String supplierRef,
        String createdBy,
        OffsetDateTime createdAt) {
}
