package com.tugaskuliah.pos.report.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * In-app notification (Milestone 8, PRD §27).
 * {@code userId == null} means broadcast: visible to every user that has
 * the {@code notification.view} authority.
 */
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    public static final String LOW_STOCK = "LOW_STOCK";
    public static final String OUT_OF_STOCK = "OUT_OF_STOCK";
    public static final String PENDING_APPROVAL = "PENDING_APPROVAL";
    public static final String SHIFT_VARIANCE = "SHIFT_VARIANCE";
    public static final String SHIFT_OPEN = "SHIFT_OPEN";
    public static final String PO_PENDING = "PO_PENDING";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nullable: null = broadcast to all users. */
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 50)
    private String type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "entity_type", length = 50)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
