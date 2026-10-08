package com.tugaskuliah.pos.auth.repository;

import com.tugaskuliah.pos.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update RefreshToken t set t.revoked = true where t.user.id = :userId and t.revoked = false")
    void revokeAllByUserId(Long userId);

    @Modifying
    @Query("delete from RefreshToken t where t.revoked = true or t.expiresAt < current_timestamp")
    void deleteRevokedOrExpired();
}
