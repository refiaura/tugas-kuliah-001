package com.tugaskuliah.pos.inventory.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record AdjustmentResponse(
        Long id,
        String docNo,
        Long productId,
        String productName,
        BigDecimal qtyChange,
        String reason,
        String createdBy,
        OffsetDateTime createdAt) {
}
