package com.tugaskuliah.pos.control.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ReturnLineRequest(
        @NotNull(message = "saleItemId wajib") Long saleItemId,
        @NotNull(message = "qty wajib") @DecimalMin(value = "0.01", message = "qty minimal 0.01") BigDecimal qty,
        @NotNull(message = "kondisi wajib") String condition // SELLABLE | DAMAGED
) {}
