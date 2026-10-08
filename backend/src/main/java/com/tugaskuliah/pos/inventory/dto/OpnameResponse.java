package com.tugaskuliah.pos.inventory.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record OpnameResponse(
        Long id,
        String docNo,
        String status,
        String location,
        String notes,
        String createdBy,
        OffsetDateTime createdAt,
        List<OpnameLineResponse> lines) {
}
