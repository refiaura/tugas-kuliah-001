package com.tugaskuliah.pos.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record OpnameLineRequest(
        @NotNull Long productId,
        @NotNull @DecimalMin("0") BigDecimal countedQty) {
}
