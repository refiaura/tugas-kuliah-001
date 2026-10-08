package com.tugaskuliah.pos.shift.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CashMovementRequest(
        @NotNull CashMovementType type,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotBlank @Size(max = 255) String reason,
        @Size(max = 100) String referenceNo) {

    public enum CashMovementType { IN, OUT }
}
