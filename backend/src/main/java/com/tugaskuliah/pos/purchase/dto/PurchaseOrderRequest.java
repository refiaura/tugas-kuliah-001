package com.tugaskuliah.pos.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record PurchaseOrderRequest(
        @NotNull Long supplierId,
        @Size(max = 2000) String notes,
        @NotEmpty(message = "minimal satu baris produk") @Valid List<PoLineRequest> lines) {
}
