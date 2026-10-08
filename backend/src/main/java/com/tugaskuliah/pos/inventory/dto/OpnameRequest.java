package com.tugaskuliah.pos.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record OpnameRequest(
        @Size(max = 100) String location,
        @Size(max = 1000) String notes,
        @NotEmpty @Valid List<OpnameLineRequest> lines) {
}
