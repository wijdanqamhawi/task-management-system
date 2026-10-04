"""Paging per contracts/rest-api.md: 0-based page, size default 20, max 100."""
import math

from fastapi import Query


class PageParams:
    def __init__(self, page: int = Query(0, ge=0), size: int = Query(20, ge=1, le=100)):
        self.page = page
        self.size = size

    @property
    def offset(self) -> int:
        return self.page * self.size


def page_response(content: list, params: PageParams, total: int) -> dict:
    return {
        "content": content,
        "page": params.page,
        "size": params.size,
        "totalElements": total,
        "totalPages": math.ceil(total / params.size) if total else 0,
    }
