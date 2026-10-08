package com.tugaskuliah.pos.purchase.dto;

import java.math.BigDecimal;

public record PoLineResponse(
        Long id,
        Long productId,
        String productName,
        BigDecimal qty,
        BigDecimal unitPrice,
        BigDecimal lineTotal,
        BigDecimal receivedQty,
        BigDecimal returnedQty) {
}
