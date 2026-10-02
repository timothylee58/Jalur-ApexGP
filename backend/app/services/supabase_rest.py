"""The few lines every Supabase-backed feature needs to talk to PostgREST
with the server-only service_role key. See picks_service's docstring for
the trust boundary: the frontend never holds this key, and RLS with no
permissive policies keeps a leaked anon key from reading anything.
"""

from __future__ import annotations

from app.config import settings

READ_ONLY_MESSAGE = (
    "This is a preview deployment: it shows live data but doesn't save anything. "
    "Use jalur-apexgp.vercel.app to submit."
)


class SupabaseNotConfigured(Exception):
    """SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset — a deploy
    problem, surfaced as a 503 rather than pretending there's no data."""


class SupabaseReadOnly(Exception):
    """A write attempted from a read-only deploy (see config.py)."""


def configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def read_only() -> bool:
    if settings.supabase_read_only is not None:
        return settings.supabase_read_only
    return settings.vercel_env == "preview"


def writable() -> bool:
    return configured() and not read_only()


def headers(*, prefer: str | None = None) -> dict[str, str]:
    if not configured():
        raise SupabaseNotConfigured("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.")
    out = {
        "apikey": settings.supabase_service_role_key or "",
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        out["Prefer"] = prefer
    return out


def write_headers(*, prefer: str | None = None) -> dict[str, str]:
    """`headers()` for a write — refused on a read-only deploy, so no write
    path can reach production from a preview by forgetting a check."""
    if read_only():
        raise SupabaseReadOnly(READ_ONLY_MESSAGE)
    return headers(prefer=prefer)


def rest_url(path: str) -> str:
    return f"{(settings.supabase_url or '').rstrip('/')}/rest/v1/{path}"
