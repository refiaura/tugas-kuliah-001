package com.tugaskuliah.pos.user.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.user.dto.PermissionResponse;
import com.tugaskuliah.pos.user.service.PermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/permissions")
@RequiredArgsConstructor
public class PermissionController {

    private final PermissionService permissionService;

    @GetMapping
    @PreAuthorize("hasAuthority('user.view')")
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.ok(permissionService.list(), "Daftar permission"));
    }
}
