package com.tugaskuliah.pos.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Standard API envelope (PRD §32).
 * Success: { success:true, message, data, pagination? }
 * Error:   { success:false, message, data:null }
 */
@Getter
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final String message;
    private final T data;
    private final PaginationInfo pagination;

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, message, data, null);
    }

    public static <T> ApiResponse<T> ok(T data) {
        return ok(data, "Success");
    }

    public static <T> ApiResponse<T> paged(T data, String message, int page, int size,
                                          long totalElements, int totalPages) {
        return new ApiResponse<>(true, message, data,
                new PaginationInfo(page, size, totalElements, totalPages));
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null, null);
    }

    @Getter
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PaginationInfo {
        private final int page;
        private final int size;
        private final long totalElements;
        private final int totalPages;
    }
}
