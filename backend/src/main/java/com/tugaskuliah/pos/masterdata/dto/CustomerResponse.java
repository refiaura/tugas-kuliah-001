package com.tugaskuliah.pos.masterdata.dto;

public record CustomerResponse(
        Long id, String customerCode, String name, String phone,
        String address, String memberStatus, int points, boolean active) {
}
