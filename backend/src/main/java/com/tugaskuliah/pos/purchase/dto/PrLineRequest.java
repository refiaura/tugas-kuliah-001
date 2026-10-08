package com.tugaskuliah.pos.purchase.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record PrLineRequest(
        @NotNull Long poLineId,
        @NotNull @DecimalMin(value = "0.01", message = "qty retur harus positif") BigDecimal qty) {
}
