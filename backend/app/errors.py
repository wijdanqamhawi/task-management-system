"""Error handling: every non-2xx response has the body defined in
contracts/rest-api.md, section "Error body". FastAPI's default {"detail": ...} would break the
frontend client, which reads `message` and `fieldErrors`."""
import logging
from datetime import datetime
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status: int, message: str, field_errors: dict | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.field_errors = field_errors


def bad_request(message: str, **field_errors: str) -> ApiError:
    return ApiError(400, message, dict(field_errors) or None)


def unauthorized(message: str = "Authentication required") -> ApiError:
    return ApiError(401, message)


def forbidden(message: str = "You do not have permission to perform this action") -> ApiError:
    return ApiError(403, message)


def not_found(message: str = "Not found") -> ApiError:
    return ApiError(404, message)


def conflict(message: str) -> ApiError:
    return ApiError(409, message)


def _body(status: int, message: str, path: str, field_errors: dict | None = None,
          error: str | None = None) -> dict:
    try:
        phrase = HTTPStatus(status).phrase
    except ValueError:
        phrase = "Error"
    body = {
        "timestamp": datetime.now().replace(microsecond=0).isoformat(),
        "status": status,
        "error": error or phrase,
        "message": message,
        "path": path,
    }
    if field_errors:
        body["fieldErrors"] = field_errors
    return body


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError):
        error = "Validation failed" if exc.status == 400 else None
        return JSONResponse(
            _body(exc.status, exc.message, request.url.path, exc.field_errors, error),
            status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        fields: dict[str, str] = {}
        for err in exc.errors():
            loc = [p for p in err["loc"] if p not in ("body", "query", "path")]
            name = str(loc[-1]) if loc else "request"
            msg = err["msg"].removeprefix("Value error, ")
            fields.setdefault(name, msg)
        message = next(iter(fields.values()), "Validation failed")
        return JSONResponse(
            _body(400, message, request.url.path, fields, "Validation failed"), status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            _body(exc.status_code, str(exc.detail), request.url.path), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        logging.getLogger("tms").exception("Unhandled error on %s", request.url.path)
        return JSONResponse(_body(500, "Internal server error", request.url.path), status_code=500)
