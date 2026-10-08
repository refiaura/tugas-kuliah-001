package com.tugaskuliah.pos.control.service;

import tools.jackson.databind.ObjectMapper;
import com.tugaskuliah.pos.control.dto.AuditLogResponse;
import com.tugaskuliah.pos.control.entity.AuditLog;
import com.tugaskuliah.pos.control.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reusable append-only audit log (PRD §5.1, Milestone 7).
 * Only INSERT + read; there is intentionally no update/delete path
 * (no mutation endpoint either).
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    /** Record one audit entry in the current transaction. */
    public void log(String actor, String action, String entityType, Object entityId,
                    Object oldValue, Object newValue) {
        AuditLog a = new AuditLog();
        a.setActor(actor != null ? actor : "system");
        a.setAction(action);
        a.setEntityType(entityType);
        a.setEntityId(entityId != null ? String.valueOf(entityId) : "-");
        a.setOldValue(toJson(oldValue));
        a.setNewValue(toJson(newValue));
        auditLogRepository.save(a);
    }

    public void log(String actor, String action, String entityType, Object entityId) {
        log(actor, action, entityType, entityId, null, null);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> list(String entityType, Pageable pageable) {
        Page<AuditLog> page = (entityType == null || entityType.isBlank())
                ? auditLogRepository.findAllByOrderByCreatedAtDesc(pageable)
                : auditLogRepository.findByEntityTypeOrderByCreatedAtDesc(entityType, pageable);
        return page.map(a -> new AuditLogResponse(
                a.getId(), a.getActor(), a.getAction(), a.getEntityType(), a.getEntityId(),
                a.getOldValue(), a.getNewValue(), a.getCreatedAt()));
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String s) {
            return s;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }
}
