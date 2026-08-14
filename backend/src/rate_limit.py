"""A single shared slowapi limiter for the whole application.

slowapi's ``@limiter.limit(...)`` decorator resolves the limiter from ``request.app.state.limiter``
at call time, so the instance the routers decorate with must be the same one registered on the app
in ``src/app.py``. Sharing one limiter here also means the configured limits are counted once per
client rather than separately per router.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
