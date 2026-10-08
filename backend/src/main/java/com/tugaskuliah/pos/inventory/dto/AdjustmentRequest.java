package com.tugaskuliah.pos.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record AdjustmentRequest(
        @NotNull Long productId,
        @NotNull BigDecimal qtyChange,
        @NotBlank @Size(max = 255) String reason) {
}
