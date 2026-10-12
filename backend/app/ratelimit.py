"""Small in-memory sliding-window rate limiter for the password-reset endpoints.

State is per process, so with several workers each has its own window; the per-account limit
is additionally backed by a database count (modules/auth/reset.py), which is shared.
Limits (approved): 10 reset requests per hour per IP, 3 per hour per e-mail address.
"""
import threading
import time
from collections import defaultdict, deque

HOUR = 3600
FORGOT_PER_IP = 10          # POST /api/auth/forgot-password, per client IP, per hour
FORGOT_PER_EMAIL = 3        # per e-mail address, per hour
RESET_FAILURES_PER_IP = 20  # invalid / expired token attempts, per client IP, per hour


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: int = HOUR, clock=time.monotonic):
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _live(self, key: str, now: float) -> deque:
        hits = self._hits[key]
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        return hits

    def allow(self, key: str) -> bool:
        """Record one attempt and say whether it is within the limit."""
        with self._lock:
            now = self._clock()
            hits = self._live(key, now)
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def available(self, key: str) -> bool:
        """True while the key has not exhausted its allowance (records nothing)."""
        with self._lock:
            return len(self._live(key, self._clock())) < self.limit

    def hit(self, key: str) -> None:
        with self._lock:
            now = self._clock()
            self._live(key, now).append(now)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


forgot_ip = SlidingWindowLimiter(FORGOT_PER_IP)
forgot_email = SlidingWindowLimiter(FORGOT_PER_EMAIL)
reset_failures_ip = SlidingWindowLimiter(RESET_FAILURES_PER_IP)


def clear_all() -> None:
    for limiter in (forgot_ip, forgot_email, reset_failures_ip):
        limiter.clear()
