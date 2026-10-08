package com.tugaskuliah.pos.masterdata.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdatePriceRequest(
        @NotNull @DecimalMin("0") BigDecimal sellingPrice,
        @DecimalMin("0") BigDecimal purchasePrice,
        @Size(max = 255) String reason) {
}
