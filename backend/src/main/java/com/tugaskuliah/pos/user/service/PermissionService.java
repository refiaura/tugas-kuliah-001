package com.tugaskuliah.pos.user.service;

import com.tugaskuliah.pos.user.dto.PermissionResponse;
import com.tugaskuliah.pos.user.mapper.RoleMapper;
import com.tugaskuliah.pos.user.repository.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PermissionService {

    private final PermissionRepository permissionRepository;
    private final RoleMapper roleMapper;

    @Transactional(readOnly = true)
    public List<PermissionResponse> list() {
        return permissionRepository.findAllByOrderByGroupNameAscCodeAsc().stream()
                .map(roleMapper::toResponse).toList();
    }
}
