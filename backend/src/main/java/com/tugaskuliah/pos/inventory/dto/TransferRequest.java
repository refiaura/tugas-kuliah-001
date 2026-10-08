package com.tugaskuliah.pos.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record TransferRequest(
        @NotNull Long productId,
        @NotNull @DecimalMin("0.01") BigDecimal qty,
        @NotBlank @Size(max = 100) String fromLocation,
        @NotBlank @Size(max = 100) String toLocation,
        @Size(max = 1000) String notes) {
}
