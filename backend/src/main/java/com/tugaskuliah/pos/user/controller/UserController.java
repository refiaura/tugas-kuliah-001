package com.tugaskuliah.pos.user.controller;

import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.user.dto.CreateUserRequest;
import com.tugaskuliah.pos.user.dto.UpdateUserRequest;
import com.tugaskuliah.pos.user.dto.UserResponse;
import com.tugaskuliah.pos.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAuthority('user.view')")
    public ResponseEntity<ApiResponse<List<UserResponse>>> list(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<UserResponse> page = userService.list(search, pageable);
        return ResponseEntity.ok(ApiResponse.paged(page.getContent(), "Daftar pengguna",
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('user.view')")
    public ResponseEntity<ApiResponse<UserResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(userService.get(id), "Detail pengguna"));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('user.create')")
    public ResponseEntity<ApiResponse<UserResponse>> create(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(userService.create(request), "Pengguna dibuat"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user.update')")
    public ResponseEntity<ApiResponse<UserResponse>> update(
            @PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(userService.update(id, request), "Pengguna diperbarui"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user.delete')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Pengguna dihapus"));
    }
}
