package com.tugaskuliah.pos.shift.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record OpenShiftRequest(
        @NotNull @DecimalMin("0") BigDecimal openingCash,
        @Size(max = 500) String notes) {
}
