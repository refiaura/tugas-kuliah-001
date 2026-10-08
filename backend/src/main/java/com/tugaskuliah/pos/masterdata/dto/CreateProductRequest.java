package com.tugaskuliah.pos.masterdata.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record CreateProductRequest(
        @NotBlank @Size(max = 50) String sku,
        @Size(max = 50) String barcode,
        @NotBlank @Size(max = 200) String name,
        Long categoryId,
        @NotNull Long unitId,
        @NotNull @DecimalMin("0") BigDecimal purchasePrice,
        @NotNull @DecimalMin("0") BigDecimal sellingPrice,
        @DecimalMin("0") BigDecimal minimumStock,
        Boolean active) {
}
