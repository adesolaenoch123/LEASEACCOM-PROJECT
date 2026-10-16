from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from config import settings


class MessageService:
    """Persist conversations and messages for authenticated participants."""

    def __init__(self) -> None:
        self.client: Optional[Client] = None
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    def _participant_column(self, role: str) -> str:
        if role == "tenant":
            return "tenant_id"
        if role == "owner":
            return "owner_id"
        raise ValueError("Tenant or owner access required.")

    def _add_conversation_details(self, conversations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not self.client or not conversations:
            return conversations

        property_ids = list({str(item["property_id"]) for item in conversations if item.get("property_id")})
        profile_ids = list({
            str(participant_id)
            for item in conversations
            for participant_id in (item.get("tenant_id"), item.get("owner_id"))
            if participant_id
        })

        properties = []
        if property_ids:
            response = (
                self.client.table("properties")
                .select("id,title,location,city,owner_name,cover_image,image,images")
                .in_("id", property_ids)
                .execute()
            )
            properties = response.data or []

        profiles = []
        if profile_ids:
            response = (
                self.client.table("profiles")
                .select("id,full_name,avatar_url")
                .in_("id", profile_ids)
                .execute()
            )
            profiles = response.data or []

        properties_by_id = {str(item["id"]): item for item in properties}
        profiles_by_id = {str(item["id"]): item for item in profiles}
        for conversation in conversations:
            property_data = properties_by_id.get(str(conversation.get("property_id")), {})
            owner = profiles_by_id.get(str(conversation.get("owner_id")), {})
            tenant = profiles_by_id.get(str(conversation.get("tenant_id")), {})
            images = property_data.get("images") or []
            conversation.update({
                "property_title": property_data.get("title") or "Property",
                "property_image": property_data.get("cover_image") or property_data.get("image") or (images[0] if images else ""),
                "property_location": property_data.get("location") or property_data.get("city") or "Nigeria",
                "owner_name": property_data.get("owner_name") or owner.get("full_name") or "Property Owner",
                "owner_avatar": owner.get("avatar_url") or "",
                "tenant_name": tenant.get("full_name") or "Tenant",
                "tenant_avatar": tenant.get("avatar_url") or "",
            })
        return conversations

    async def list_conversations(self, user_id: str, role: str) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        response = (
            self.client.table("conversations")
            .select("*")
            .eq(self._participant_column(role), user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return self._add_conversation_details(response.data or [])

    async def get_conversation(self, conversation_id: str, user_id: str, role: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        response = (
            self.client.table("conversations")
            .select("*")
            .eq("id", conversation_id)
            .eq(self._participant_column(role), user_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None

    async def get_or_create_conversation(
        self, property_id: str, tenant_id: str, owner_id: str
    ) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        existing = (
            self.client.table("conversations")
            .select("*")
            .eq("property_id", property_id)
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .limit(1)
            .execute()
        )
        rows = existing.data or []
        if rows:
            return self._add_conversation_details(rows)[0]

        created = (
            self.client.table("conversations")
            .insert({
                "property_id": property_id,
                "tenant_id": tenant_id,
                "owner_id": owner_id,
            })
            .execute()
        )
        if not created.data:
            raise RuntimeError("Unable to create conversation.")
        return self._add_conversation_details(created.data)[0]

    async def list_messages(self, conversation_id: str) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        response = (
            self.client.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
        return response.data or []

    async def create_message(
        self, conversation_id: str, user_id: str, role: str, body: str
    ) -> Optional[Dict[str, Any]]:
        if not self.client:
            raise RuntimeError("Supabase backend is not configured.")

        conversation = await self.get_conversation(conversation_id, user_id, role)
        if not conversation:
            return None

        created = (
            self.client.table("messages")
            .insert({
                "conversation_id": conversation_id,
                "sender_id": user_id,
                "body": body,
            })
            .execute()
        )
        if not created.data:
            raise RuntimeError("Unable to send message.")

        self.client.table("conversations").update({
            "last_message": body,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", conversation_id).execute()

        return {"conversation": conversation, "message": created.data[0]}