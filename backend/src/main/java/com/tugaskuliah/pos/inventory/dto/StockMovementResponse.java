package com.tugaskuliah.pos.inventory.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Read-only stock movement (ledger) projection. */
public record StockMovementResponse(
        Long id,
        Long productId,
        String productName,
        BigDecimal qtyChange,
        String movementType,
        String location,
        String referenceType,
        Long referenceId,
        String createdBy,
        OffsetDateTime createdAt) {
}
