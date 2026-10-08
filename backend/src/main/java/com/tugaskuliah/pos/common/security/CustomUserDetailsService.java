package com.tugaskuliah.pos.common.security;

import com.tugaskuliah.pos.user.entity.Permission;
import com.tugaskuliah.pos.user.entity.Role;
import com.tugaskuliah.pos.user.entity.User;
import com.tugaskuliah.pos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.stream.Collectors;

/** Loads user + roles + permissions with a single fetch graph. */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findWithRolesByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(username));
        return new UserPrincipal(
                user.getId(),
                user.getUsername(),
                user.getPasswordHash(),
                user.isActive(),
                user.getRoles().stream().map(Role::getName).collect(Collectors.toSet()),
                user.getRoles().stream()
                        .flatMap(r -> r.getPermissions().stream())
                        .map(Permission::getCode)
                        .collect(Collectors.toSet()));
    }
}
