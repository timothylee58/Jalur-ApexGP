"""Vercel Python entrypoint. Exposes the existing FastAPI app as an ASGI
callable — Vercel's Python runtime wraps any `app` object it finds here.
See vercel.json: every request is rewritten to this function, so the app's
own routes (/predict, /health) keep their real paths.
"""

from app.main import app as app
