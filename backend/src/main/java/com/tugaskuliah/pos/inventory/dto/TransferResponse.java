package com.tugaskuliah.pos.inventory.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TransferResponse(
        Long id,
        String docNo,
        Long productId,
        String productName,
        BigDecimal qty,
        String fromLocation,
        String toLocation,
        String status,
        String createdBy,
        OffsetDateTime createdAt) {
}
