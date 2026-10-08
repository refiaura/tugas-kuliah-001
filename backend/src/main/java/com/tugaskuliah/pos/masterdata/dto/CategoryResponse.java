package com.tugaskuliah.pos.masterdata.dto;

public record CategoryResponse(Long id, String name, Long parentId, String parentName, boolean active) {
}
