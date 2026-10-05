import unittest
from unittest.mock import AsyncMock, patch

import main
from fastapi import HTTPException


class ApplicationRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_application_owner_is_derived_from_approved_property(self):
        user = {"id": "tenant-1", "email": "tenant@example.com", "role": "tenant"}
        property_data = {
            "id": "property-1",
            "owner_id": "actual-owner",
            "verification_status": "approved",
            "title": "Two-bedroom flat",
            "city": "Lagos",
            "price": 2500000,
        }
        created_application = {"id": "application-1", "owner_id": "actual-owner"}
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.property_service, "client", object()),
            patch.object(main.property_service, "get_property", new=AsyncMock(return_value=property_data)),
            patch.object(main.application_service, "create_application", new=AsyncMock(return_value=created_application)) as create_application,
        ):
            result = await main.create_application(
                main.ApplicationCreateRequest(
                    property_id="property-1",
                    applicant_name="Tenant One",
                    applicant_phone="08000000000",
                    move_in_date="2026-11-01",
                    owner_id="attacker-controlled-owner",
                ),
                "Bearer verified-token",
            )

        self.assertEqual(result["application"]["owner_id"], "actual-owner")
        create_application.assert_awaited_once()
        args = create_application.await_args.args
        self.assertEqual(args[1:], ("tenant-1", "actual-owner"))
        self.assertEqual(args[0]["applicant_email"], "tenant@example.com")

    async def test_application_rejects_unapproved_property(self):
        user = {"id": "tenant-1", "email": "tenant@example.com", "role": "tenant"}
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.property_service, "client", object()),
            patch.object(main.property_service, "get_property", new=AsyncMock(return_value={
                "id": "property-1",
                "owner_id": "owner-1",
                "verification_status": "pending",
            })),
            patch.object(main.application_service, "create_application", new=AsyncMock()) as create_application,
        ):
            with self.assertRaises(HTTPException) as error:
                await main.create_application(
                    main.ApplicationCreateRequest(
                        property_id="property-1",
                        applicant_name="Tenant One",
                        applicant_phone="08000000000",
                        move_in_date="2026-11-01",
                    ),
                    "Bearer verified-token",
                )

        self.assertEqual(error.exception.status_code, 409)
        create_application.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
