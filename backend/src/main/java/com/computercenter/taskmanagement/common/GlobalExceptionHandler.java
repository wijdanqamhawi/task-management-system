package com.computercenter.taskmanagement.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * T034 — every failure leaves the API in the shape contracts/rest-api.md § Error body defines.
 *
 * <p>Messages are actionable: they state what went wrong, without leaking whether a record the
 * caller may not see exists (FR-053).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex, HttpServletRequest request) {
        return ResponseEntity.status(ex.getStatus()).body(ErrorResponse.of(
                ex.getStatus().value(),
                ex.getStatus().getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()));
    }

    /** Bean Validation failures at the trust boundary (Constitution IV). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex,
                                                          HttpServletRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        String first = fieldErrors.isEmpty() ? "Request validation failed"
                : fieldErrors.values().iterator().next();
        return ResponseEntity.badRequest()
                .body(ErrorResponse.validation(first, request.getRequestURI(), fieldErrors));
    }

    /** A @PreAuthorize role check refused the call (FR-005, SC-007). */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex,
                                                            HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse.of(
                403, "Forbidden", "You do not have permission to perform this action",
                request.getRequestURI()));
    }

    /**
     * Unique constraint violation — a duplicate username or email (contract, 409).
     * Never a concurrent modification: concurrent updates are last-write-wins (R-014).
     */
    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ErrorResponse> handleDuplicate(DuplicateKeyException ex,
                                                         HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(
                409, "Conflict", "That value is already in use", request.getRequestURI()));
    }
}
