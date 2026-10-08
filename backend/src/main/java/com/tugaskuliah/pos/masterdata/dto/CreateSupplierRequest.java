package com.tugaskuliah.pos.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSupplierRequest(
        @NotBlank @Size(max = 50) String supplierCode,
        @NotBlank @Size(max = 200) String name,
        @Size(max = 30) String phone,
        @Size(max = 100) String email,
        String address,
        @Size(max = 50) String taxNumber,
        @Size(max = 50) String paymentTerm,
        Boolean active) {
}
