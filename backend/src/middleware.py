"""Small ASGI middlewares: a request-body size cap and baseline security headers.

Both are written as plain ASGI middlewares rather than Starlette ``BaseHTTPMiddleware`` so they can
act on the raw request/response without buffering it — the body cap in particular has to refuse an
oversized upload *before* it is read into memory, which is the whole point of it.
"""

import logging

logger = logging.getLogger(__name__)


class _BodyTooLarge(Exception):
    """Raised from the wrapped receive when the streamed body passes the cap."""


class MaxBodySizeMiddleware:
    """Reject request bodies larger than ``max_bytes`` with a 413.

    Two layers. A declared ``Content-Length`` over the limit is refused immediately, without reading
    a single byte — that is the DoS vector that matters, a client announcing a huge upload. The
    actual streamed bytes are then counted as well, so a chunked or mis-declared body cannot slip a
    large payload past the header check. Every endpoint reads its body before sending anything, so
    aborting mid-stream lands before any response has started.
    """

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        for name, value in scope["headers"]:
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    return await self._reject(send)
                if declared > self.max_bytes:
                    return await self._reject(send)
                break

        seen = 0
        started = False

        async def guarded_receive():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_bytes:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, guarded_receive, tracking_send)
        except _BodyTooLarge:
            # If the response has already begun there is nothing safe to append; the connection
            # simply drops. In practice this branch is reached before the handler responds.
            if not started:
                await self._reject(send)

    async def _reject(self, send) -> None:
        body = b'{"detail":"Request body too large."}'
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


class SecurityHeadersMiddleware:
    """Attach a small set of baseline response headers.

    This is a JSON API, so these are defence in depth rather than the primary control — but they are
    cheap and close off whole classes of mistake: ``nosniff`` stops a response being reinterpreted
    as something executable, ``DENY`` keeps any response out of a frame, and the referrer policy
    stops URLs leaking outward. HSTS is only asserted when the deployment is actually serving over
    HTTPS (signalled by the same flag that makes the session cookie Secure); asserting it over plain
    HTTP would be meaningless, and asserting it wrongly can hard-pin browsers to a scheme the site
    cannot serve.
    """

    def __init__(self, app, *, hsts: bool):
        self.app = app
        self._headers = [
            (b"x-content-type-options", b"nosniff"),
            (b"x-frame-options", b"DENY"),
            (b"referrer-policy", b"no-referrer"),
        ]
        if hsts:
            self._headers.append(
                (b"strict-transport-security", b"max-age=31536000; includeSubDomains")
            )

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                existing = {name for name, _ in message["headers"]}
                message["headers"].extend(
                    (name, value) for name, value in self._headers if name not in existing
                )
            await send(message)

        await self.app(scope, receive, send_with_headers)
