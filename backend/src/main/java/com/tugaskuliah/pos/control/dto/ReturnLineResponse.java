package com.tugaskuliah.pos.control.dto;

import java.math.BigDecimal;

public record ReturnLineResponse(
        Long saleItemId,
        String productName,
        BigDecimal qty,
        BigDecimal unitPrice,
        BigDecimal lineDiscount,
        String condition
) {}
