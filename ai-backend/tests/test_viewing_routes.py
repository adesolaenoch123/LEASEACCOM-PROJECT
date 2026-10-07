import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import main
from fastapi import HTTPException


class ViewingRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_viewing_owner_is_derived_from_approved_property(self):
        user = {"id": "tenant-1", "email": "tenant@example.com", "role": "tenant"}
        property_data = {
            "id": "property-1",
            "owner_id": "actual-owner",
            "verification_status": "approved",
        }
        created_viewing = {"id": "viewing-1", "owner_id": "actual-owner"}
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.property_service, "client", object()),
            patch.object(main.property_service, "get_property", new=AsyncMock(return_value=property_data)),
            patch.object(main.viewing_service, "create_viewing", new=AsyncMock(return_value=created_viewing)) as create_viewing,
            patch.object(main.notification_service, "create_notification", new=AsyncMock()) as create_notification,
        ):
            result = await main.create_viewing_request(
                main.ViewingRequestCreateRequest(
                    property_id="property-1",
                    preferred_date="2026-11-01",
                    preferred_time="2:00 PM",
                    notes="Please call when you arrive.",
                ),
                "Bearer verified-token",
            )

        self.assertEqual(result["viewing_request"]["owner_id"], "actual-owner")
        create_viewing.assert_awaited_once()
        args = create_viewing.await_args.args
        self.assertEqual(args[1:], ("tenant-1", "actual-owner"))
        self.assertNotIn("owner_id", args[0])
        create_notification.assert_awaited_once()
        self.assertEqual(create_notification.await_args.args[0]["user_id"], "actual-owner")

    async def test_viewing_rejects_unapproved_property(self):
        user = {"id": "tenant-1", "role": "tenant"}
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.property_service, "client", object()),
            patch.object(main.property_service, "get_property", new=AsyncMock(return_value={
                "id": "property-1",
                "owner_id": "owner-1",
                "verification_status": "pending",
            })),
            patch.object(main.viewing_service, "create_viewing", new=AsyncMock()) as create_viewing,
        ):
            with self.assertRaises(HTTPException) as error:
                await main.create_viewing_request(
                    main.ViewingRequestCreateRequest(property_id="property-1"),
                    "Bearer verified-token",
                )

        self.assertEqual(error.exception.status_code, 409)
        create_viewing.assert_not_awaited()

    async def test_owner_status_update_is_scoped_to_authenticated_owner(self):
        user = {"id": "owner-1", "role": "owner"}
        updated_viewing = {
            "id": "viewing-1",
            "owner_id": "owner-1",
            "tenant_id": "tenant-1",
            "status": "accepted",
        }
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.viewing_service, "update_viewing", new=AsyncMock(return_value=updated_viewing)) as update_viewing,
            patch.object(main.notification_service, "create_notification", new=AsyncMock()) as create_notification,
        ):
            result = await main.update_viewing_request(
                "viewing-1",
                main.ViewingStatusUpdateRequest(status="accepted"),
                "Bearer owner-token",
            )

        self.assertEqual(result["viewing_request"]["status"], "accepted")
        update_viewing.assert_awaited_once_with(
            "viewing-1", {"status": "accepted"}, "owner-1", "owner"
        )
        create_notification.assert_awaited_once()
        self.assertEqual(create_notification.await_args.args[0]["user_id"], "tenant-1")


if __name__ == "__main__":
    unittest.main()