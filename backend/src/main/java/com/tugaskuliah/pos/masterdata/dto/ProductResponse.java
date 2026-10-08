package com.tugaskuliah.pos.masterdata.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProductResponse(
        Long id, String sku, String barcode, String name,
        Long categoryId, String categoryName,
        Long unitId, String unitCode,
        BigDecimal purchasePrice, BigDecimal sellingPrice, BigDecimal minimumStock,
        boolean active, String imageUrl, List<VariantResponse> variants) {
}
