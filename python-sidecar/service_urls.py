"""Resolve Next.js / sidecar URLs — production public hosts vs local dev."""
import os

PRODUCTION_APP_URL = "https://serp-bear-neon.vercel.app"
LOCAL_NEXTJS_URL = "http://127.0.0.1:3000"


def _is_deployed() -> bool:
    return bool(os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("VERCEL"))


def nextjs_url() -> str:
    explicit = (os.getenv("NEXTJS_URL") or os.getenv("APP_BASE_URL") or "").strip()
    if explicit:
        return explicit.replace("localhost", "127.0.0.1").rstrip("/")

    public = (os.getenv("NEXT_PUBLIC_APP_URL") or "").strip()
    if public and _is_deployed():
        return public.replace("localhost", "127.0.0.1").rstrip("/")

    if _is_deployed():
        return PRODUCTION_APP_URL

    return LOCAL_NEXTJS_URL
