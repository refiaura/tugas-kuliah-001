package com.tugaskuliah.pos.sales.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CheckoutPaymentRequest(
        @NotNull Long paymentMethodId,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @Size(max = 100) String referenceNo) {
}
