package com.tugaskuliah.pos.auth.service;

import com.tugaskuliah.pos.auth.dto.LoginRequest;
import com.tugaskuliah.pos.auth.dto.LoginResponse;
import com.tugaskuliah.pos.auth.dto.RefreshTokenRequest;
import com.tugaskuliah.pos.auth.dto.TokenResponse;
import com.tugaskuliah.pos.auth.entity.RefreshToken;
import com.tugaskuliah.pos.auth.repository.RefreshTokenRepository;
import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.JwtService;
import com.tugaskuliah.pos.common.security.UserPrincipal;
import com.tugaskuliah.pos.control.service.AuditService;
import com.tugaskuliah.pos.user.dto.UserResponse;
import com.tugaskuliah.pos.user.entity.Permission;
import com.tugaskuliah.pos.user.entity.Role;
import com.tugaskuliah.pos.user.entity.User;
import com.tugaskuliah.pos.user.mapper.UserMapper;
import com.tugaskuliah.pos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.stream.Collectors;

/**
 * Authentication with JWT access tokens and rotating opaque refresh tokens.
 * Reuse of a revoked refresh token revokes ALL of the user's sessions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserMapper userMapper;
    private final PlatformTransactionManager transactionManager;
    private final AuditService auditService;
    private final LoginAttemptService loginAttemptService;

    @Transactional
    public LoginResponse login(LoginRequest request) {
        if (loginAttemptService.isLocked(request.username())) {
            log.warn("Blocked login for locked username={}", request.username());
            throw new ApiException(ErrorCode.AUTH_TOO_MANY_ATTEMPTS);
        }
        User user = userRepository.findWithRolesByUsername(request.username())
                .orElseThrow(() -> {
                    loginAttemptService.recordFailure(request.username());
                    return new ApiException(ErrorCode.AUTH_INVALID_CREDENTIALS);
                });
        if (!user.isActive()) {
            throw new ApiException(ErrorCode.AUTH_USER_INACTIVE);
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            log.warn("Failed login attempt for username={}", request.username());
            loginAttemptService.recordFailure(request.username());
            throw new ApiException(ErrorCode.AUTH_INVALID_CREDENTIALS);
        }
        loginAttemptService.recordSuccess(request.username());
        TokenResponse token = issueTokens(user);
        log.info("User logged in: id={} username={}", user.getId(), user.getUsername());
        auditService.log(user.getUsername(), "USER_LOGIN", "USER", user.getId());
        return new LoginResponse(token, userMapper.toResponse(user));
    }

    @Transactional
    public TokenResponse refresh(RefreshTokenRequest request) {
        String hash = JwtService.sha256Hex(request.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_TOKEN_INVALID));

        if (stored.isRevoked()) {
            // Reuse detected: possible theft -> revoke everything for this user.
            // Must commit independently: the ApiException below rolls back this tx.
            revokeAllSessions(stored.getUser().getId());
            log.warn("Refresh token reuse detected for userId={}", stored.getUser().getId());
            throw new ApiException(ErrorCode.AUTH_REFRESH_REUSE_DETECTED);
        }
        if (stored.isExpired()) {
            stored.setRevoked(true);
            throw new ApiException(ErrorCode.AUTH_TOKEN_INVALID);
        }
        if (!stored.getUser().isActive()) {
            throw new ApiException(ErrorCode.AUTH_USER_INACTIVE);
        }
        stored.setRevoked(true); // rotation
        User user = userRepository.findWithRolesByUsername(stored.getUser().getUsername())
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_TOKEN_INVALID));
        return issueTokens(user);
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        String hash = JwtService.sha256Hex(request.refreshToken());
        refreshTokenRepository.findByTokenHash(hash).ifPresent(t -> {
            t.setRevoked(true);
            auditService.log(t.getUser().getUsername(), "USER_LOGOUT", "USER", t.getUser().getId());
        });
    }

    @Transactional(readOnly = true)
    public UserResponse me() {
        return userMapper.toResponse(currentUser());
    }

    // ---------- helpers ----------

    /**
     * Revokes all refresh tokens for a user in an independent transaction,
     * so the revocation survives even when the caller's transaction rolls back.
     */
    public void revokeAllSessions(Long userId) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.executeWithoutResult(status -> refreshTokenRepository.revokeAllByUserId(userId));
    }

    private TokenResponse issueTokens(User user) {
        UserPrincipal principal = toPrincipal(user);
        String accessToken = jwtService.generateAccessToken(principal);
        String refreshToken = jwtService.generateRefreshToken();

        RefreshToken entity = new RefreshToken();
        entity.setUser(user);
        entity.setTokenHash(JwtService.sha256Hex(refreshToken));
        entity.setExpiresAt(OffsetDateTime.now().plusNanos(jwtService.getRefreshExpirationMs() * 1_000_000));
        refreshTokenRepository.save(entity);

        return TokenResponse.bearer(accessToken, refreshToken,
                jwtService.getAccessExpirationMs() / 1000);
    }

    private UserPrincipal toPrincipal(User user) {
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

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ApiException(ErrorCode.AUTH_TOKEN_INVALID);
        }
        return userRepository.findWithRolesByUsername(principal.getUsername())
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_TOKEN_INVALID));
    }
}
