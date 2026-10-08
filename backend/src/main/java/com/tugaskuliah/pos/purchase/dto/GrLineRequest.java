package com.tugaskuliah.pos.purchase.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record GrLineRequest(
        @NotNull Long poLineId,
        @NotNull @DecimalMin(value = "0.01", message = "qty terima harus positif") BigDecimal receivedQty) {
}
