package com.tugaskuliah.pos.user.dto;

import java.util.List;

public record UserResponse(
        Long id,
        String username,
        String fullName,
        String email,
        String phone,
        boolean active,
        List<String> roles,
        List<String> permissions) {
}
