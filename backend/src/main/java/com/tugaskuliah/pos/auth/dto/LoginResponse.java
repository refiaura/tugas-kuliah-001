package com.tugaskuliah.pos.auth.dto;

import com.tugaskuliah.pos.user.dto.UserResponse;

public record LoginResponse(
        TokenResponse token,
        UserResponse user) {
}
