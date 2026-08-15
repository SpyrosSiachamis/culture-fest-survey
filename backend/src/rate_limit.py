"""A single shared slowapi limiter for the whole application.

slowapi's ``@limiter.limit(...)`` decorator resolves the limiter from ``request.app.state.limiter``
at call time, so the instance the routers decorate with must be the same one registered on the app
in ``src/app.py``. Sharing one limiter here also means the configured limits are counted once per
client rather than separately per router.

The counters live in this process's memory (slowapi's default in-memory store). That is correct
only with a **single worker**: run the API with two uvicorn workers and each keeps its own counts,
so the effective limit doubles and a client can be balanced across them. Both the dev and the
production images run one worker on purpose (neither passes ``--workers``); if the API is ever
scaled out, move the limiter to a shared backend (e.g. Redis via ``storage_uri``) so the counts are
shared across processes.

The client key is ``request.client.host``. Behind a reverse proxy that is the proxy's address, so
``src/app.py`` restores the real client IP with ProxyHeadersMiddleware — but only from a trusted
proxy (``TRUSTED_PROXY_IPS``), so the key cannot be spoofed via ``X-Forwarded-For``.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
