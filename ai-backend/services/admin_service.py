from __future__ import annotations

from typing import Any, Dict, Optional

from supabase import Client, create_client

from config import settings


class AdminService:
    """Admin operations for leaseaccom dashboards and moderation flows."""

    def __init__(self) -> None:
        self.client: Optional[Client] = None

        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    async def get_summary(self) -> Dict[str, Any]:
        if not self.client:
            return {
                "total_properties": 0,
                "approved_properties": 0,
                "pending_verifications": 0,
                "total_users": 0,
                "message": "Supabase backend configuration is not set yet.",
            }

        try:
            properties = self.client.table("properties").select("id, verification_status").execute()
            users = self.client.table("profiles").select("id").execute()
            approval_count = 0
            pending_count = 0
            for row in properties.data or []:
                if row.get("verification_status") == "approved":
                    approval_count += 1
                elif row.get("verification_status") in {"pending", "submitted", "in_review"}:
                    pending_count += 1

            return {
                "total_properties": len(properties.data or []),
                "approved_properties": approval_count,
                "pending_verifications": pending_count,
                "total_users": len(users.data or []),
            }
        except Exception:
            return {
                "total_properties": 0,
                "approved_properties": 0,
                "pending_verifications": 0,
                "total_users": 0,
                "message": "Admin summary could not be loaded from Supabase yet.",
            }

    async def list_properties(self) -> list[dict]:
        if not self.client:
            return []

        try:
            response = self.client.table("properties").select("*").order("created_at", desc=True).execute()
            return response.data or []
        except Exception:
            return []
