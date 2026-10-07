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
        self.profile_client: Optional[Client] = None

        if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.profile_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    @classmethod
    def _demo_user(cls, token: str) -> Optional[Dict[str, str]]:
        if not settings.ALLOW_DEMO_AUTH:
            return None
        return cls.DEMO_USERS.get(token)

    async def get_session_user(self, authorization: Optional[str]) -> Optional[Dict[str, Any]]:
        if not authorization:
            return None

        scheme, _, token = authorization.strip().partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            return None
        token = token.strip()

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
        if app_metadata.get("role") == "admin":
            return {"id": user.id, "email": user.email, "role": "admin"}

        role = "user"
        if self.profile_client:
            try:
                response = (
                    self.profile_client.table("profiles")
                    .select("account_type")
                    .eq("id", user.id)
                    .maybe_single()
                    .execute()
                )
                profile = response.data or {}
                if profile.get("account_type") in {"tenant", "owner"}:
                    role = profile["account_type"]
            except Exception:
                pass

        return {"id": user.id, "email": user.email, "role": role}
