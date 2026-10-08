package com.tugaskuliah.pos.user.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.user.dto.CreateRoleRequest;
import com.tugaskuliah.pos.user.dto.RoleResponse;
import com.tugaskuliah.pos.user.entity.Permission;
import com.tugaskuliah.pos.user.entity.Role;
import com.tugaskuliah.pos.user.mapper.RoleMapper;
import com.tugaskuliah.pos.user.repository.PermissionRepository;
import com.tugaskuliah.pos.user.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Role management. System roles cannot be deleted. */
@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RoleMapper roleMapper;

    @Transactional(readOnly = true)
    public List<RoleResponse> list() {
        return roleRepository.findAllWithPermissions().stream()
                .map(roleMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public RoleResponse get(Long id) {
        return roleMapper.toResponse(findById(id));
    }

    @Transactional
    public RoleResponse create(CreateRoleRequest request) {
        if (roleRepository.findByName(request.name()).isPresent()) {
            throw ApiException.conflict("Nama role sudah digunakan");
        }
        Role role = new Role();
        role.setName(request.name());
        role.setDescription(request.description());
        role.setSystem(false);
        role.setPermissions(resolvePermissions(request.permissions()));
        return roleMapper.toResponse(roleRepository.save(role));
    }

    @Transactional
    public RoleResponse assignPermissions(Long id, Set<String> codes) {
        Role role = findById(id);
        role.setPermissions(resolvePermissions(codes));
        return roleMapper.toResponse(roleRepository.save(role));
    }

    @Transactional
    public void delete(Long id) {
        Role role = findById(id);
        if (role.isSystem()) {
            throw ApiException.business("Role sistem tidak dapat dihapus");
        }
        roleRepository.delete(role);
    }

    private Role findById(Long id) {
        return roleRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Role"));
    }

    private Set<Permission> resolvePermissions(Set<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return new HashSet<>();
        }
        Set<Permission> perms = permissionRepository.findByCodeIn(codes);
        if (perms.size() != codes.size()) {
            throw ApiException.notFound("Permission");
        }
        return perms;
    }
}
