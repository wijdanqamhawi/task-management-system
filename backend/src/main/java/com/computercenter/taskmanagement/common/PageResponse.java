package com.computercenter.taskmanagement.common;

import java.util.List;

/**
 * T035 — the paged list shape from contracts/rest-api.md § Conventions:
 * {@code { content, page, size, totalElements, totalPages }}.
 *
 * <p>Defaults: page 0, size 20, maximum size 100.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public static <T> PageResponse<T> of(List<T> content, int page, int size, long totalElements) {
        int totalPages = size <= 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        return new PageResponse<>(content, page, size, totalElements, totalPages);
    }

    /** Clamps a caller-supplied page size into the contract's permitted range. */
    public static int clampSize(Integer requested) {
        if (requested == null || requested <= 0) {
            return DEFAULT_SIZE;
        }
        return Math.min(requested, MAX_SIZE);
    }

    public static int clampPage(Integer requested) {
        return (requested == null || requested < 0) ? 0 : requested;
    }
}
