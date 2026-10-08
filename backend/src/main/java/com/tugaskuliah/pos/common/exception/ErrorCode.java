package com.tugaskuliah.pos.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/** Machine-readable error codes with HTTP semantics. */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // auth
    AUTH_INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Username atau password salah"),
    AUTH_USER_INACTIVE(HttpStatus.FORBIDDEN, "Akun pengguna tidak aktif"),
    AUTH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "Token tidak valid atau kadaluarsa"),
    AUTH_TOKEN_REVOKED(HttpStatus.UNAUTHORIZED, "Token sudah tidak berlaku"),
    AUTH_REFRESH_REUSE_DETECTED(HttpStatus.UNAUTHORIZED, "Refresh token reuse terdeteksi; semua sesi dicabut"),

    // generic
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Validasi gagal"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Data tidak ditemukan"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Tidak memiliki izin"),
    CONFLICT(HttpStatus.CONFLICT, "Data konflik"),
    BUSINESS_ERROR(HttpStatus.UNPROCESSABLE_ENTITY, "Business rule dilanggar"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Terjadi kesalahan internal");

    private final HttpStatus httpStatus;
    private final String defaultMessage;
}
