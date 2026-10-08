package com.tugaskuliah.pos.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCustomerRequest(
        @NotBlank @Size(max = 50) String customerCode,
        @NotBlank @Size(max = 200) String name,
        @Size(max = 30) String phone,
        String address,
        String memberStatus,
        Boolean active) {
}
