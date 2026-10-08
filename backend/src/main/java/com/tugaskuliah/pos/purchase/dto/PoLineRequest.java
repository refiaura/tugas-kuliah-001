package com.tugaskuliah.pos.purchase.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record PoLineRequest(
        @NotNull Long productId,
        @NotNull @DecimalMin(value = "0.01", message = "qty harus positif") BigDecimal qty,
        @NotNull @DecimalMin(value = "0.00", message = "harga tidak boleh negatif") BigDecimal unitPrice) {
}
