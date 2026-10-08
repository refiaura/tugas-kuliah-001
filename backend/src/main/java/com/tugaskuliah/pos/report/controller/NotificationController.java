package com.tugaskuliah.pos.report.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.report.dto.NotificationResponse;
import com.tugaskuliah.pos.report.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * In-app notifications (Milestone 8, PRD §27).
 * Lists the current user's notifications plus broadcasts (user_id null).
 */
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("hasAuthority('notification.view')")
    public ResponseEntity<ApiResponse<java.util.List<NotificationResponse>>> list(
            @PageableDefault(size = 20) Pageable pageable) {
        var page = notificationService.list(pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Notifikasi",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasAuthority('notification.view')")
    public ResponseEntity<ApiResponse<Map<String, Long>>> unreadCount() {
        return ResponseEntity.ok(ApiResponse.ok(
                Map.of("unreadCount", notificationService.unreadCount()), "Jumlah belum dibaca"));
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("hasAuthority('notification.view')")
    public ResponseEntity<ApiResponse<NotificationResponse>> markRead(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(notificationService.markRead(id), "Notifikasi ditandai dibaca"));
    }

    @PostMapping("/read-all")
    @PreAuthorize("hasAuthority('notification.view')")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> markAllRead() {
        return ResponseEntity.ok(ApiResponse.ok(
                Map.of("markedRead", notificationService.markAllRead()), "Semua notifikasi ditandai dibaca"));
    }
}
