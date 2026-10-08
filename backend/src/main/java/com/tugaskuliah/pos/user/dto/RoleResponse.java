package com.tugaskuliah.pos.user.dto;

import java.util.List;

public record RoleResponse(
        Long id,
        String name,
        String description,
        boolean system,
        List<String> permissions) {
}
