package com.tugaskuliah.pos.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ReceiptRequest(
        @NotNull Long productId,
        @NotNull @DecimalMin("0.01") BigDecimal qty,
        @Size(max = 100) String location,
        @Size(max = 100) String supplierRef,
        @Size(max = 1000) String notes) {
}
