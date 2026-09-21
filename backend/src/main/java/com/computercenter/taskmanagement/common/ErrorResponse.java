package com.computercenter.taskmanagement.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * T034 — the single error body shape every non-2xx response uses.
 * Defined in contracts/rest-api.md § Error body.
 *
 * <p>{@code fieldErrors} is present only for 400.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        LocalDateTime timestamp,
        int status,
        String error,
        String message,
        String path,
        Map<String, String> fieldErrors) {

    public static ErrorResponse of(int status, String error, String message, String path) {
        return new ErrorResponse(LocalDateTime.now(), status, error, message, path, null);
    }

    public static ErrorResponse validation(String message, String path,
                                           Map<String, String> fieldErrors) {
        return new ErrorResponse(LocalDateTime.now(), 400, "Validation failed",
                message, path, fieldErrors);
    }
}
