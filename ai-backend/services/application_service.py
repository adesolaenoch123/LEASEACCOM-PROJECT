from __future__ import annotations

from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from config import settings


class ApplicationService:
    """Tenant applications for properties."""

    def __init__(self) -> None:
        self.client: Optional[Client] = None

        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    async def list_applications(self, user_id: str, role: str) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        try:
            query = self.client.table("applications").select("*")
            if role == "tenant":
                query = query.eq("tenant_id", user_id)
            elif role == "owner":
                query = query.eq("owner_id", user_id)
            elif role == "admin":
                pass
            else:
                query = query.eq("tenant_id", user_id)

            response = query.order("created_at", desc=True).execute()
            return response.data or []
        except Exception:
            return []

    async def get_application(self, application_id: str, user_id: str, role: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None

        try:
            query = self.client.table("applications").select("*").eq("id", application_id)
            if role == "tenant":
                query = query.eq("tenant_id", user_id)
            elif role == "owner":
                query = query.eq("owner_id", user_id)
            response = query.single().execute()
            return response.data
        except Exception:
            return None

    async def create_application(self, payload: Dict[str, Any], tenant_id: str, owner_id: str) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        data = {
            **payload,
            "tenant_id": tenant_id,
            "owner_id": owner_id,
            "status": "submitted",
        }
        response = self.client.table("applications").insert(data).execute()
        return response.data[0] if response.data else data

    async def update_application(
        self, application_id: str, payload: Dict[str, Any], user_id: str, role: str
    ) -> Optional[Dict[str, Any]]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        query = self.client.table("applications").update(payload).eq("id", application_id)
        if role == "owner":
            query = query.eq("owner_id", user_id)
        response = query.select("*").execute()
        return response.data[0] if response.data else None
