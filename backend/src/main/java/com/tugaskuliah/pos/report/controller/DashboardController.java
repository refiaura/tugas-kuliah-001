package com.tugaskuliah.pos.report.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.report.dto.DashboardResponse;
import com.tugaskuliah.pos.report.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Operational dashboard (Milestone 8, PRD §24).
 */
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    @PreAuthorize("hasAuthority('report.sales')")
    public ResponseEntity<ApiResponse<DashboardResponse>> dashboard() {
        return ResponseEntity.ok(ApiResponse.ok(dashboardService.dashboard(), "Dashboard"));
    }
}
