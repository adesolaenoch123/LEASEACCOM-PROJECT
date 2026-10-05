from __future__ import annotations

from typing import Any, Dict, List, Optional

from supabase import create_client

from config import settings


class PropertySearchTool:
    """Server-side tool for searching approved property records in Supabase."""

    def __init__(self) -> None:
        self.client = None

        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            return

        self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    async def search_properties(
        self,
        query: str = "",
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        filters = filters or {}

        db_query = self.client.table("properties").select("*")
        db_query = db_query.eq("verification_status", "approved")

        if query and query.strip():
            db_query = db_query.ilike("title", f"%{query.strip()}%")

        city = filters.get("city")
        if city:
            db_query = db_query.ilike("city", f"%{str(city).strip()}%")

        property_type = filters.get("type")
        if property_type and property_type != "all":
            db_query = db_query.eq("type", str(property_type))

        max_price = filters.get("max_price")
        if max_price is not None:
            try:
                db_query = db_query.lte("price", float(max_price))
            except (TypeError, ValueError):
                pass

        response = db_query.order("created_at", desc=True).limit(5).execute()
        return response.data or []

    async def get_property_by_id(self, property_id: Any) -> Optional[Dict[str, Any]]:
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
