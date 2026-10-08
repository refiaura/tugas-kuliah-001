package com.tugaskuliah.pos.inventory.dto;

import java.math.BigDecimal;

/** Current balance per product (read-only). */
public record StockBalanceResponse(
        Long productId,
        String sku,
        String name,
        BigDecimal qty,
        BigDecimal minimumStock) {
}
