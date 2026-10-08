package com.tugaskuliah.pos.auth.service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Simple in-memory brute-force protection for login (Milestone 9 hardening).
 *
 * After MAX_ATTEMPTS failed logins for a username within the tracking window,
 * further attempts are blocked for LOCKOUT_DURATION. Successful login clears
 * the counter. This is intentionally in-memory: for a single-instance POS
 * backend it is sufficient; a distributed deployment would move this to Redis/DB.
 */
@Service
@Slf4j
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCKOUT_SECONDS = 300; // 5 minutes
    private static final long WINDOW_SECONDS = 600; // 10 minutes tracking window

    private record AttemptInfo(int failures, Instant firstFailure, Instant lockedUntil) {
    }

    private final Map<String, AttemptInfo> attempts = new ConcurrentHashMap<>();

    /** Returns true if the username is currently locked out. */
    public boolean isLocked(String username) {
        AttemptInfo info = attempts.get(key(username));
        if (info == null || info.lockedUntil() == null) {
            return false;
        }
        if (Instant.now().isAfter(info.lockedUntil())) {
            attempts.remove(key(username));
            return false;
        }
        return true;
    }

    /** Record a failed login. Locks the account when the threshold is hit. */
    public void recordFailure(String username) {
        String k = key(username);
        Instant now = Instant.now();
        attempts.compute(k, (ignored, info) -> {
            if (info == null || now.isAfter(info.firstFailure().plusSeconds(WINDOW_SECONDS))) {
                return new AttemptInfo(1, now, null);
            }
            int failures = info.failures() + 1;
            Instant lockedUntil = failures >= MAX_ATTEMPTS
                    ? now.plusSeconds(LOCKOUT_SECONDS)
                    : info.lockedUntil();
            if (lockedUntil != null) {
                log.warn("Login locked out for username={} after {} failures", username, failures);
            }
            return new AttemptInfo(failures, info.firstFailure(), lockedUntil);
        });
    }

    /** Clear the counter after a successful login. */
    public void recordSuccess(String username) {
        attempts.remove(key(username));
    }

    private String key(String username) {
        return username == null ? "" : username.toLowerCase();
    }
}
