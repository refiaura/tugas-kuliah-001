package com.tugaskuliah.pos.report.dto;

import java.time.OffsetDateTime;

/** In-app notification payload (PRD §27). */
public record NotificationResponse(
        Long id,
        String type,
        String title,
        String message,
        String entityType,
        Long entityId,
        boolean read,
        OffsetDateTime createdAt) {
}
