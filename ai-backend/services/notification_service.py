from __future__ import annotations

from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from config import settings


class NotificationService:
    """User notifications for LeaseHub events."""

    def __init__(self) -> None:
        self.client: Optional[Client] = None

        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    async def list_notifications(self, user_id: str) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        try:
            response = (
                self.client.table("notifications")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            return response.data or []
        except Exception:
            return []

    async def create_notification(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        response = self.client.table("notifications").insert(payload).execute()
        return response.data[0] if response.data else payload

    async def mark_read(self, notification_id: str, user_id: str) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        response = (
            self.client.table("notifications")
            .update({"read": True})
            .eq("id", notification_id)
            .eq("user_id", user_id)
            .execute()
        )
        return response.data[0] if response.data else {"id": notification_id, "read": True}
