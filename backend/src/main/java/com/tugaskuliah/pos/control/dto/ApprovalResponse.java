package com.tugaskuliah.pos.control.dto;

import java.time.OffsetDateTime;

public record ApprovalResponse(
        Long id,
        String subjectType,
        Long subjectId,
        String subjectLabel,
        String requestedBy,
        String reason,
        String status,
        String decidedBy,
        OffsetDateTime decidedAt,
        String decisionNote,
        OffsetDateTime createdAt
) {}
