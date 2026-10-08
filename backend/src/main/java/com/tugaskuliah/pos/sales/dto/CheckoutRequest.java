package com.tugaskuliah.pos.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record CheckoutRequest(
        @NotEmpty @Valid List<CheckoutItemRequest> items,
        @NotEmpty @Valid List<CheckoutPaymentRequest> payments,
        Long customerId,
        @DecimalMin("0") BigDecimal discountTotal,
        @Size(max = 500) String notes,
        @Size(max = 100) String idempotencyKey) {
}
