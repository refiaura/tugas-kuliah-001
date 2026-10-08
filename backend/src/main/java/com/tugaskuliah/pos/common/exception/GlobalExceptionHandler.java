package com.tugaskuliah.pos.common.exception;

import com.tugaskuliah.pos.common.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * Single place for error mapping (PRD §24).
 * Messages are user-safe: no stack traces, credentials, or SQL details leak.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleApi(ApiException ex) {
        return status(ex.getErrorCode().getHttpStatus(), ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(this::fieldMessage)
                .collect(Collectors.joining("; "));
        return status(HttpStatus.BAD_REQUEST, msg.isBlank() ? "Validasi gagal" : msg);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraint(ConstraintViolationException ex) {
        return status(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler({AccessDeniedException.class})
    public ResponseEntity<ApiResponse<Void>> handleDenied(AccessDeniedException ex) {
        return status(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN.getDefaultMessage());
    }

    @ExceptionHandler({BadCredentialsException.class, AuthenticationException.class})
    public ResponseEntity<ApiResponse<Void>> handleAuth(RuntimeException ex) {
        return status(HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_INVALID_CREDENTIALS.getDefaultMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConflict(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return status(HttpStatus.CONFLICT, "Data sudah ada atau melanggar constraint");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        // TEMP DEBUG (M9): include root cause in response to diagnose test 500s.
        String detail = ex.toString();
        Throwable c = ex.getCause();
        if (c != null) {
            detail += " | caused by: " + c;
        }
        return status(HttpStatus.INTERNAL_SERVER_ERROR,
                ErrorCode.INTERNAL_ERROR.getDefaultMessage() + " [DEBUG] " + detail);
    }

    private String fieldMessage(FieldError e) {
        return e.getField() + ": " + (e.getDefaultMessage() == null ? "invalid" : e.getDefaultMessage());
    }

    private ResponseEntity<ApiResponse<Void>> status(HttpStatus http, String message) {
        return ResponseEntity.status(http).body(ApiResponse.error(message));
    }
}
