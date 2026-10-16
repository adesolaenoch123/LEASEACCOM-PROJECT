import unittest
from unittest.mock import AsyncMock, patch

import main
from fastapi import HTTPException


class MessageRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_tenant_starts_conversation_with_listing_owner(self):
        user = {"id": "tenant-1", "role": "tenant"}
        listing = {
            "id": "property-1",
            "owner_id": "owner-1",
            "verification_status": "approved",
        }
        conversation = {"id": "conversation-1", "tenant_id": "tenant-1", "owner_id": "owner-1"}
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.property_service, "client", object()),
            patch.object(main.property_service, "get_property", new=AsyncMock(return_value=listing)),
            patch.object(main.message_service, "get_or_create_conversation", new=AsyncMock(return_value=conversation)) as create,
        ):
            result = await main.create_conversation(
                main.ConversationCreateRequest(property_id="property-1"),
                "Bearer tenant-token",
            )

        self.assertEqual(result["conversation"], conversation)
        create.assert_awaited_once_with("property-1", "tenant-1", "owner-1")

    async def test_tenant_cannot_start_conversation_for_unapproved_property(self):
        user = {"id": "tenant-1", "role": "tenant"}
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.property_service, "client", object()),
            patch.object(main.property_service, "get_property", new=AsyncMock(return_value={
                "id": "property-1",
                "owner_id": "owner-1",
                "verification_status": "pending",
            })),
            patch.object(main.message_service, "get_or_create_conversation", new=AsyncMock()) as create,
        ):
            with self.assertRaises(HTTPException) as error:
                await main.create_conversation(
                    main.ConversationCreateRequest(property_id="property-1"),
                    "Bearer tenant-token",
                )

        self.assertEqual(error.exception.status_code, 409)
        create.assert_not_awaited()

    async def test_message_sender_is_taken_from_authenticated_session(self):
        user = {"id": "owner-1", "role": "owner"}
        saved = {
            "conversation": {"id": "conversation-1", "owner_id": "owner-1", "tenant_id": "tenant-1"},
            "message": {"id": "message-1", "sender_id": "owner-1", "body": "Hello"},
        }
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.message_service, "create_message", new=AsyncMock(return_value=saved)) as create,
            patch.object(main.notification_service, "create_notification", new=AsyncMock()),
        ):
            result = await main.create_conversation_message(
                "conversation-1",
                main.MessageCreateRequest(body=" Hello "),
                "Bearer owner-token",
            )

        self.assertEqual(result["message"]["sender_id"], "owner-1")
        create.assert_awaited_once_with("conversation-1", "owner-1", "owner", "Hello")

    async def test_message_requires_authenticated_participant(self):
        user = {"id": "other-owner", "role": "owner"}
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.message_service, "create_message", new=AsyncMock(return_value=None)),
        ):
            with self.assertRaises(HTTPException) as error:
                await main.create_conversation_message(
                    "conversation-1",
                    main.MessageCreateRequest(body="Hello"),
                    "Bearer owner-token",
                )

        self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()