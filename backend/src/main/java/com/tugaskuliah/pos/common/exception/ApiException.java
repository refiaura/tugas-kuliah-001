package com.tugaskuliah.pos.common.exception;

import lombok.Getter;

/** Application exception carrying an {@link ErrorCode}. Never leaks internals. */
@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    public ApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public static ApiException notFound(String entity) {
        return new ApiException(ErrorCode.NOT_FOUND, entity + " tidak ditemukan");
    }

    public static ApiException conflict(String message) {
        return new ApiException(ErrorCode.CONFLICT, message);
    }

    public static ApiException business(String message) {
        return new ApiException(ErrorCode.BUSINESS_ERROR, message);
    }
}
