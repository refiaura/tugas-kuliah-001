package com.tugaskuliah.pos.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record HoldRequest(
        @NotEmpty @Valid List<CheckoutItemRequest> items,
        Long customerId,
        @Size(max = 500) String notes) {
}
