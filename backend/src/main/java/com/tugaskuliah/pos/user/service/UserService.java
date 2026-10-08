package com.tugaskuliah.pos.user.service;

import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.user.dto.CreateUserRequest;
import com.tugaskuliah.pos.user.dto.UpdateUserRequest;
import com.tugaskuliah.pos.user.dto.UserResponse;
import com.tugaskuliah.pos.user.entity.Role;
import com.tugaskuliah.pos.user.entity.User;
import com.tugaskuliah.pos.user.mapper.UserMapper;
import com.tugaskuliah.pos.user.repository.RoleRepository;
import com.tugaskuliah.pos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/** User management. Passwords are always BCrypt-hashed; usernames unique. */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;

    @Transactional(readOnly = true)
    public Page<UserResponse> list(String search, Pageable pageable) {
        Page<User> page = (search == null || search.isBlank())
                ? userRepository.findAll(pageable)
                : userRepository.findByUsernameContainingIgnoreCaseOrFullNameContainingIgnoreCase(
                        search, search, pageable);
        return page.map(userMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse get(Long id) {
        return userMapper.toResponse(findById(id));
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw ApiException.conflict("Username sudah digunakan");
        }
        User user = new User();
        user.setUsername(request.username());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setActive(true);
        user.setRoles(resolveRoles(request.roles()));
        user.setCreatedBy(currentUserId());
        return userMapper.toResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse update(Long id, UpdateUserRequest request) {
        User user = findById(id);
        user.setFullName(request.fullName());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        if (request.active() != null) {
            if (!request.active() && id.equals(currentUserId())) {
                throw ApiException.business("Tidak dapat menonaktifkan akun sendiri");
            }
            user.setActive(request.active());
        }
        if (request.roles() != null) {
            user.setRoles(resolveRoles(request.roles()));
        }
        user.setUpdatedBy(currentUserId());
        return userMapper.toResponse(userRepository.save(user));
    }

    @Transactional
    public void delete(Long id) {
        User user = findById(id);
        if (id.equals(currentUserId())) {
            throw ApiException.business("Tidak dapat menghapus akun sendiri");
        }
        userRepository.delete(user);
    }

    // ---------- helpers ----------

    private User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("User"));
    }

    private Set<Role> resolveRoles(Set<String> names) {
        if (names == null || names.isEmpty()) {
            return Set.of();
        }
        Set<Role> roles = roleRepository.findByNameIn(names);
        if (roles.size() != names.size()) {
            throw ApiException.notFound("Role");
        }
        return roles;
    }

    private Long currentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getId();
        }
        return null;
    }
}
