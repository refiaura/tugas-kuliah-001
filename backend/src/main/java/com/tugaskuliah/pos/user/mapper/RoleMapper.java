package com.tugaskuliah.pos.user.mapper;

import com.tugaskuliah.pos.user.dto.PermissionResponse;
import com.tugaskuliah.pos.user.dto.RoleResponse;
import com.tugaskuliah.pos.user.entity.Permission;
import com.tugaskuliah.pos.user.entity.Role;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring")
public interface RoleMapper {

    @Mapping(target = "system", source = "system")
    @Mapping(target = "permissions", expression = "java(permissionCodes(role.getPermissions()))")
    RoleResponse toResponse(Role role);

    PermissionResponse toResponse(Permission permission);

    default List<String> permissionCodes(Set<Permission> permissions) {
        if (permissions == null) return List.of();
        return permissions.stream().map(Permission::getCode).sorted().collect(Collectors.toList());
    }
}
