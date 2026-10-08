package com.tugaskuliah.pos.purchase.dto;

import java.math.BigDecimal;

public record PrLineResponse(
        Long id,
        Long poLineId,
        Long productId,
        String productName,
        BigDecimal qty,
        BigDecimal unitPrice,
        BigDecimal creditAmount) {
}
