package com.tugaskuliah.pos.sales.dto;

import java.math.BigDecimal;

public record SaleItemResponse(
        Long productId, String sku, String name,
        BigDecimal qty, BigDecimal unitPrice, BigDecimal discount, BigDecimal subtotal) {
}
