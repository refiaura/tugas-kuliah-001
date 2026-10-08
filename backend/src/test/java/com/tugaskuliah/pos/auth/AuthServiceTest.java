package com.tugaskuliah.pos.auth;

import com.tugaskuliah.pos.auth.dto.LoginRequest;
import com.tugaskuliah.pos.auth.dto.LoginResponse;
import com.tugaskuliah.pos.auth.dto.RefreshTokenRequest;
import com.tugaskuliah.pos.auth.dto.TokenResponse;
import com.tugaskuliah.pos.auth.entity.RefreshToken;
import com.tugaskuliah.pos.auth.repository.RefreshTokenRepository;
import com.tugaskuliah.pos.auth.service.AuthService;
import com.tugaskuliah.pos.common.exception.ApiException;
import com.tugaskuliah.pos.common.exception.ErrorCode;
import com.tugaskuliah.pos.common.security.JwtService;
import com.tugaskuliah.pos.user.entity.Permission;
import com.tugaskuliah.pos.user.entity.Role;
import com.tugaskuliah.pos.user.entity.User;
import com.tugaskuliah.pos.user.mapper.UserMapper;
import com.tugaskuliah.pos.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock JwtService jwtService;
    @Mock PlatformTransactionManager transactionManager;

    PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    UserMapper userMapper = Mappers.getMapper(UserMapper.class);
    AuthService authService;

    User kasir;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, refreshTokenRepository,
                passwordEncoder, jwtService, userMapper, transactionManager);
        // Let TransactionTemplate execute callbacks synchronously in unit tests.
        lenient().when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(new SimpleTransactionStatus());

        Permission p = new Permission();
        p.setCode("sales.create");
        Role role = new Role();
        role.setName("KASIR");
        role.setPermissions(Set.of(p));

        kasir = new User();
        kasir.setId(1L);
        kasir.setUsername("kasir1");
        kasir.setPasswordHash(passwordEncoder.encode("rahasia123"));
        kasir.setFullName("Kasir Satu");
        kasir.setActive(true);
        kasir.setRoles(Set.of(role));

        lenient().when(jwtService.getAccessExpirationMs()).thenReturn(900_000L);
        lenient().when(jwtService.getRefreshExpirationMs()).thenReturn(604_800_000L);
        lenient().when(jwtService.generateAccessToken(any())).thenReturn("access-token");
        lenient().when(jwtService.generateRefreshToken()).thenReturn("refresh-token");
    }

    @Test
    void login_success() {
        when(userRepository.findWithRolesByUsername("kasir1")).thenReturn(Optional.of(kasir));

        LoginResponse res = authService.login(new LoginRequest("kasir1", "rahasia123"));

        assertNotNull(res.token().accessToken());
        assertNotNull(res.token().refreshToken());
        assertEquals("kasir1", res.user().username());
        assertTrue(res.user().permissions().contains("sales.create"));
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void login_wrongPassword_unauthorized() {
        when(userRepository.findWithRolesByUsername("kasir1")).thenReturn(Optional.of(kasir));

        ApiException ex = assertThrows(ApiException.class,
                () -> authService.login(new LoginRequest("kasir1", "salah")));
        assertEquals(ErrorCode.AUTH_INVALID_CREDENTIALS, ex.getErrorCode());
    }

    @Test
    void login_unknownUser_unauthorized() {
        when(userRepository.findWithRolesByUsername("ghost")).thenReturn(Optional.empty());

        ApiException ex = assertThrows(ApiException.class,
                () -> authService.login(new LoginRequest("ghost", "x")));
        assertEquals(ErrorCode.AUTH_INVALID_CREDENTIALS, ex.getErrorCode());
    }

    @Test
    void login_inactiveUser_forbidden() {
        kasir.setActive(false);
        when(userRepository.findWithRolesByUsername("kasir1")).thenReturn(Optional.of(kasir));

        ApiException ex = assertThrows(ApiException.class,
                () -> authService.login(new LoginRequest("kasir1", "rahasia123")));
        assertEquals(ErrorCode.AUTH_USER_INACTIVE, ex.getErrorCode());
    }

    @Test
    void refresh_rotation_revokesOldToken() {
        RefreshToken stored = storedToken(false, false);
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));
        when(userRepository.findWithRolesByUsername("kasir1")).thenReturn(Optional.of(kasir));

        TokenResponse res = authService.refresh(new RefreshTokenRequest("old-refresh"));

        assertTrue(stored.isRevoked(), "old token must be revoked (rotation)");
        assertNotNull(res.accessToken());
        verify(refreshTokenRepository, times(1)).save(any(RefreshToken.class));
    }

    @Test
    void refresh_reusedToken_revokesAllSessions() {
        RefreshToken stored = storedToken(true, false); // already revoked = reuse
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));

        ApiException ex = assertThrows(ApiException.class,
                () -> authService.refresh(new RefreshTokenRequest("reused")));
        assertEquals(ErrorCode.AUTH_REFRESH_REUSE_DETECTED, ex.getErrorCode());
        verify(refreshTokenRepository).revokeAllByUserId(1L);
    }

    @Test
    void logout_revokesToken() {
        RefreshToken stored = storedToken(false, false);
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));

        authService.logout(new RefreshTokenRequest("refresh-token"));

        assertTrue(stored.isRevoked());
    }

    private RefreshToken storedToken(boolean revoked, boolean expired) {
        RefreshToken t = new RefreshToken();
        t.setUser(kasir);
        t.setTokenHash("hash");
        t.setRevoked(revoked);
        t.setExpiresAt(expired
                ? OffsetDateTime.now().minusHours(1)
                : OffsetDateTime.now().plusDays(7));
        return t;
    }
}
