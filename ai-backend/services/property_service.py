from __future__ import annotations

from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from config import settings


class PropertyService:
    """Server-side property access layer for leaseaccom."""

    def __init__(self) -> None:
        self.client: Optional[Client] = None

        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    async def list_properties(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        filters = filters or {}

        query = self.client.table("properties").select("*")
        query = query.eq("verification_status", "approved")

        if filters.get("city"):
            query = query.ilike("city", f"%{str(filters['city']).strip()}%")

        if filters.get("type") and filters.get("type") != "all":
            query = query.eq("type", str(filters["type"]))

        if filters.get("max_price"):
            try:
                query = query.lte("price", float(filters["max_price"]))
            except (TypeError, ValueError):
                pass

        response = query.order("created_at", desc=True).limit(20).execute()
        return response.data or []

    async def get_property(self, property_id: Any) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None

        response = (
            self.client.table("properties")
            .select("*")
            .eq("id", property_id)
            .single()
            .execute()
        )
        return response.data

    async def create_property(self, payload: Dict[str, Any], owner_id: str) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        data = {
            "owner_id": owner_id,
            "verification_status": "pending",
            **payload,
        }
        response = self.client.table("properties").insert(data).execute()
        return response.data[0] if response.data else data

    async def update_property(
        self, property_id: Any, payload: Dict[str, Any], user_id: str, role: str
    ) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        query = self.client.table("properties").update(payload).eq("id", property_id)
        if role == "owner":
            query = query.eq("owner_id", user_id)
        response = query.select("*").execute()
        if not response.data:
            raise LookupError("Property not found or not owned by this account.")
        return response.data[0] if response.data else payload
