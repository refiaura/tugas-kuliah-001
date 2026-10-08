package com.tugaskuliah.pos.user.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.user.dto.CreateRoleRequest;
import com.tugaskuliah.pos.user.dto.RoleResponse;
import com.tugaskuliah.pos.user.service.RoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
public class RoleController {

    private final RoleService roleService;

    @GetMapping
    @PreAuthorize("hasAuthority('user.view')")
    public ResponseEntity<ApiResponse<List<RoleResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.ok(roleService.list(), "Daftar role"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('user.view')")
    public ResponseEntity<ApiResponse<RoleResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(roleService.get(id), "Detail role"));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('user.create')")
    public ResponseEntity<ApiResponse<RoleResponse>> create(@Valid @RequestBody CreateRoleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(roleService.create(request), "Role dibuat"));
    }

    @PostMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('user.update')")
    public ResponseEntity<ApiResponse<RoleResponse>> assignPermissions(
            @PathVariable Long id, @RequestBody Set<String> permissionCodes) {
        return ResponseEntity.ok(ApiResponse.ok(
                roleService.assignPermissions(id, permissionCodes), "Permission role diperbarui"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user.delete')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        roleService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Role dihapus"));
    }
}
