"""Resolve Next.js URL — production public hosts vs local dev."""
import os

PRODUCTION_APP_URL = "https://ranksmile.pl"
LOCAL_NEXTJS_URL = "http://127.0.0.1:3000"


def _is_deployed() -> bool:
    return bool(os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("VERCEL"))


def _is_local_url(url: str) -> bool:
    normalized = url.replace("localhost", "127.0.0.1").lower()
    return "://127.0.0.1" in normalized or "://[::1]" in normalized


def nextjs_url() -> str:
    """Public Next.js base URL for sidecar → Node callbacks.

    On Render/Railway, never fall back to 127.0.0.1 — that host is the sidecar
    container itself, so progress/SPA callbacks would always fail.
    """
    explicit = (os.getenv("NEXTJS_URL") or os.getenv("APP_BASE_URL") or "").strip()
    if explicit:
        resolved = explicit.replace("localhost", "127.0.0.1").rstrip("/")
        if _is_deployed() and _is_local_url(resolved):
            public = (os.getenv("NEXT_PUBLIC_APP_URL") or "").strip() or PRODUCTION_APP_URL
            print(
                f"[service_urls] ignoring local NEXTJS_URL={resolved!r} on deployed host — "
                f"using {public}"
            )
            return public.replace("localhost", "127.0.0.1").rstrip("/")
        return resolved

    public = (os.getenv("NEXT_PUBLIC_APP_URL") or "").strip()
    if public and _is_deployed():
        return public.replace("localhost", "127.0.0.1").rstrip("/")

    if os.getenv("RAILWAY_ENVIRONMENT"):
        raise RuntimeError("NEXTJS_URL or NEXT_PUBLIC_APP_URL required on Railway")

    if _is_deployed():
        return PRODUCTION_APP_URL

    return LOCAL_NEXTJS_URL
