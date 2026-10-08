package com.tugaskuliah.pos.masterdata.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateProductRequest(
        @Size(max = 50) String barcode,
        @Size(max = 200) String name,
        Long categoryId,
        Long unitId,
        @DecimalMin("0") BigDecimal minimumStock,
        Boolean active) {
}
