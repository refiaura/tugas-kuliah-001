package com.tugaskuliah.pos.masterdata.dto;

import java.math.BigDecimal;

public record VariantResponse(
        Long id, String name, String sku, String barcode,
        BigDecimal purchasePrice, BigDecimal sellingPrice, boolean active) {
}
