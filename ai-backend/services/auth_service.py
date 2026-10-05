from __future__ import annotations

from typing import Any, Dict, Optional

from supabase import Client, create_client

from config import settings


class AuthService:
    """Server-side authentication support for verifying signed-in users."""

    DEMO_USERS = {
        "demo-tenant-token": {"id": "demo-tenant", "email": "tenant@leasehub.local", "role": "tenant"},
        "demo-owner-token": {"id": "demo-owner", "email": "owner@leasehub.local", "role": "owner"},
        "demo-admin-token": {"id": "demo-admin", "email": "admin@leasehub.local", "role": "admin"},
    }

    def __init__(self) -> None:
        self.client: Optional[Client] = None

        if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

    @classmethod
    def _demo_user(cls, token: str) -> Optional[Dict[str, str]]:
        if not settings.ALLOW_DEMO_AUTH:
            return None
        return cls.DEMO_USERS.get(token)

    async def get_session_user(self, authorization: Optional[str]) -> Optional[Dict[str, Any]]:
        if not authorization:
            return None

        token = authorization.replace("Bearer ", "", 1).strip()
        if not token:
            return None

        if self.client is None:
            return self._demo_user(token)

        try:
            user_response = self.client.auth.get_user(token)
            user = user_response.user
            if not user:
                return None
        except Exception:
            return None

        app_metadata = getattr(user, "app_metadata", None) or {}
        user_metadata = getattr(user, "user_metadata", None) or {}
        if app_metadata.get("role") == "admin":
            role = "admin"
        else:
            role = user_metadata.get("account_type")
            if role not in {"tenant", "owner"}:
                role = "user"

        return {"id": user.id, "email": user.email, "role": role}
