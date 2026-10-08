package com.tugaskuliah.pos.user.dto;

public record PermissionResponse(
        Long id,
        String code,
        String name,
        String groupName) {
}
