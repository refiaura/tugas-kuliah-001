package com.tugaskuliah.pos.inventory.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record OpnameLineResponse(
        Long productId,
        String productName,
        BigDecimal expectedQty,
        BigDecimal countedQty,
        BigDecimal differenceQty) {
}
