package com.tugaskuliah.pos.common.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/** Authenticated user with flattened permission authorities (e.g. 'sales.create'). */
@Getter
public class UserPrincipal implements UserDetails {

    private final Long id;
    private final String username;
    private final String password;
    private final boolean active;
    private final Set<String> roleNames;
    private final Set<String> permissionCodes;

    public UserPrincipal(Long id, String username, String password, boolean active,
                         Set<String> roleNames, Set<String> permissionCodes) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.active = active;
        this.roleNames = Set.copyOf(roleNames);
        this.permissionCodes = Set.copyOf(permissionCodes);
    }

    public List<String> getRoleNames() {
        return List.copyOf(roleNames);
    }

    public List<String> getPermissionCodes() {
        return List.copyOf(permissionCodes);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return permissionCodes.stream().map(SimpleGrantedAuthority::new).toList();
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
