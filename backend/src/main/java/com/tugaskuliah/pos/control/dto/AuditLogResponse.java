package com.tugaskuliah.pos.control.dto;

import java.time.OffsetDateTime;

public record AuditLogResponse(
        Long id,
        String actor,
        String action,
        String entityType,
        String entityId,
        String oldValue,
        String newValue,
        OffsetDateTime createdAt
) {}
