package com.tugaskuliah.pos.auth.controller;

import com.tugaskuliah.pos.auth.dto.LoginRequest;
import com.tugaskuliah.pos.auth.dto.LoginResponse;
import com.tugaskuliah.pos.auth.dto.RefreshTokenRequest;
import com.tugaskuliah.pos.auth.dto.TokenResponse;
import com.tugaskuliah.pos.auth.service.AuthService;
import com.tugaskuliah.pos.common.response.ApiResponse;
import com.tugaskuliah.pos.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request), "Login berhasil"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.refresh(request), "Token diperbarui"));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request);
        return ResponseEntity.ok(ApiResponse.ok(null, "Logout berhasil"));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> me() {
        return ResponseEntity.ok(ApiResponse.ok(authService.me(), "Profil pengguna"));
    }
}
