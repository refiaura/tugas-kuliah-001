package com.tugaskuliah.pos.sales.dto;

import java.math.BigDecimal;

public record SalePaymentResponse(
        String paymentMethodCode, String paymentMethodName,
        BigDecimal amount, String referenceNo) {
}
