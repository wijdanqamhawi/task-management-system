"""Session cookie policy: "Remember me" (research.md R-002).

The session stays a Starlette signed cookie holding only the user id (no JWT, no server-side
session table). Two lifetimes are layered on top of it:

* The signed payload carries `exp` (epoch seconds) and `remember`. `deps.current_user` rejects
  a session whose `exp` has passed, so the SERVER enforces the lifetime whatever the browser
  does with the cookie: 8 hours without "Remember me", 30 days with it.
* The cookie itself is a browser-session cookie (no Max-Age) unless `remember` is set, in
  which case it gets a persistent `Max-Age` equal to the time left until `exp`.

Starlette's SessionMiddleware has a single app-wide max_age and cannot vary it per login, so
it is configured with `max_age=None` and `RememberCookieMiddleware` adds the Max-Age for
remembered sessions only.

Limitation of signed cookies: there is no server-side session store, so logout clears the
cookie in the browser but cannot revoke a copy of it before `exp`. Deactivating an account
still takes effect on its next request, because the user is re-read on every request.
"""
import time

from starlette.datastructures import MutableHeaders
from starlette.middleware.sessions import SessionMiddleware

SESSION_COOKIE = "tms_session"


def now() -> int:
    """Wall clock in epoch seconds (a function so tests can move time)."""
    return int(time.time())


class RememberCookieMiddleware:
    """Outer ASGI wrapper: adds Max-Age to the session cookie of a remembered session.

    It sits outside SessionMiddleware and shares its `scope`, so `scope["session"]` is the
    session the inner middleware is about to serialise.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                session = scope.get("session") or {}
                if session.get("remember") and session.get("exp"):
                    remaining = max(int(session["exp"]) - now(), 0)
                    headers = MutableHeaders(scope=message)
                    cookies = headers.getlist("set-cookie")
                    if cookies:
                        del headers["set-cookie"]
                        for cookie in cookies:
                            is_session = cookie.startswith(f"{SESSION_COOKIE}=")
                            is_clear = "expires=Thu, 01 Jan 1970" in cookie
                            if is_session and not is_clear and "max-age" not in cookie.lower():
                                cookie = f"{cookie}; Max-Age={remaining}"
                            headers.append("set-cookie", cookie)
            await send(message)

        await self.app(scope, receive, send_wrapper)


def install_session(app, *, secret: str, secure: bool) -> None:
    """Register the session middleware stack. HttpOnly and SameSite=Lax are always on;
    `secure` adds the Secure flag for HTTPS deployments (TMS_COOKIE_SECURE)."""
    app.add_middleware(
        SessionMiddleware, secret_key=secret, session_cookie=SESSION_COOKIE,
        max_age=None, same_site="lax", https_only=secure)
    app.add_middleware(RememberCookieMiddleware)     # added last = outermost
