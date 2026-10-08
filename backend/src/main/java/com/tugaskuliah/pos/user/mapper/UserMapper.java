package com.tugaskuliah.pos.user.mapper;

import com.tugaskuliah.pos.user.dto.UserResponse;
import com.tugaskuliah.pos.user.entity.Permission;
import com.tugaskuliah.pos.user.entity.Role;
import com.tugaskuliah.pos.user.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "roles", expression = "java(roleNames(user.getRoles()))")
    @Mapping(target = "permissions", expression = "java(permissionCodes(user.getRoles()))")
    UserResponse toResponse(User user);

    default List<String> roleNames(Set<Role> roles) {
        if (roles == null) return List.of();
        return roles.stream().map(Role::getName).sorted().toList();
    }

    default List<String> permissionCodes(Set<Role> roles) {
        if (roles == null) return List.of();
        return roles.stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getCode)
                .distinct().sorted()
                .collect(Collectors.toList());
    }
}
