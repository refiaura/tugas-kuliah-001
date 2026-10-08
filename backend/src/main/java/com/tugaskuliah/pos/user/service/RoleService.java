package com.tugaskuliah.pos.user.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.control.service.AuditService;
import com.tugaskuliah.pos.user.dto.CreateRoleRequest;
import com.tugaskuliah.pos.user.dto.RoleResponse;
import com.tugaskuliah.pos.user.entity.Permission;
import com.tugaskuliah.pos.user.entity.Role;
import com.tugaskuliah.pos.user.mapper.RoleMapper;
import com.tugaskuliah.pos.user.repository.PermissionRepository;
import com.tugaskuliah.pos.user.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final AuditService auditService;

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
        Role saved = roleRepository.save(role);
        auditService.log(currentUsername(), "ROLE_CREATED", "ROLE", saved.getId(),
                null, java.util.Map.of("name", saved.getName()));
        return roleMapper.toResponse(saved);
    }

    @Transactional
    public RoleResponse assignPermissions(Long id, Set<String> codes) {
        Role role = findById(id);
        role.setPermissions(resolvePermissions(codes));
        Role saved = roleRepository.save(role);
        auditService.log(currentUsername(), "ROLE_PERMISSIONS_UPDATED", "ROLE", saved.getId(),
                null, java.util.Map.of("name", saved.getName(), "permissions", codes));
        return roleMapper.toResponse(saved);
    }

    @Transactional
    public void delete(Long id) {
        Role role = findById(id);
        if (role.isSystem()) {
            throw ApiException.business("Role sistem tidak dapat dihapus");
        }
        roleRepository.delete(role);
        auditService.log(currentUsername(), "ROLE_DELETED", "ROLE", id,
                java.util.Map.of("name", role.getName()), null);
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

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getUsername();
        }
        return null;
    }
}
