package com.tugaskuliah.pos.purchase.dto;

import java.math.BigDecimal;

public record GrLineResponse(
        Long id,
        Long poLineId,
        Long productId,
        String productName,
        BigDecimal receivedQty) {
}
