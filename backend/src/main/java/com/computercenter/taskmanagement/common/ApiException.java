package com.computercenter.taskmanagement.common;

import org.springframework.http.HttpStatus;

/** T034 — carries the HTTP status the REST contract specifies for a failure. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    /**
     * Not found, or found but not visible to this user.
     *
     * <p>Contract § Status codes: an invisible resource returns 404 rather than 403, so the
     * existence of records the caller may not see is never disclosed (FR-053).
     */
    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }

    /** Authenticated, but the acting user's permissions do not allow this (FR-005, SC-007). */
    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }

    /** Validation failure (contract § Status codes, 400). */
    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    /** Duplicate username or email. Never used for concurrent modification (R-014). */
    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }
}
