package com.tugaskuliah.pos.sales.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CheckoutItemRequest(
        @NotNull Long productId,
        Long variantId,
        @NotNull @DecimalMin("0.01") BigDecimal qty,
        @DecimalMin("0") BigDecimal discount) {
}
