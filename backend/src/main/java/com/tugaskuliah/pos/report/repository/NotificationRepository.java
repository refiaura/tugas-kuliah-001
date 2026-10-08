package com.tugaskuliah.pos.report.repository;

import com.tugaskuliah.pos.report.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** Broadcasts (user_id null) plus the user's own notifications, newest first. */
    @Query("""
            SELECT n FROM Notification n
            WHERE n.userId IS NULL OR n.userId = :userId
            ORDER BY n.createdAt DESC
            """)
    Page<Notification> findVisibleForUser(@Param("userId") Long userId, Pageable pageable);

    @Query("""
            SELECT COUNT(n) FROM Notification n
            WHERE n.read = false AND (n.userId IS NULL OR n.userId = :userId)
            """)
    long countUnreadForUser(@Param("userId") Long userId);

    @Modifying
    @Query("""
            UPDATE Notification n SET n.read = true
            WHERE n.read = false AND (n.userId IS NULL OR n.userId = :userId)
            """)
    int markAllReadForUser(@Param("userId") Long userId);

    /** Deduplication: unread notification of the same type+entity within the window. */
    boolean existsByTypeAndEntityTypeAndEntityIdAndReadFalseAndCreatedAtAfter(
            String type, String entityType, Long entityId, OffsetDateTime after);
}
