import unittest
from unittest.mock import AsyncMock, patch

import main
from fastapi import HTTPException


class AgreementRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_derives_parties_and_terms_from_accepted_application(self):
        user = {"id": "tenant-1", "role": "tenant"}
        application = {
            "id": "application-1",
            "status": "accepted",
            "owner_id": "owner-1",
            "tenant_id": "tenant-1",
            "property_id": "property-1",
            "property_title": "Lekki Apartment",
            "property_price": 2800000,
            "property_period": "year",
            "move_in_date": "2026-11-01",
        }
        saved_agreement = {"id": "agreement-1", "owner_id": "owner-1", "tenant_id": "tenant-1"}
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value=user)),
            patch.object(main.application_service, "get_application", new=AsyncMock(return_value=application)) as get_application,
            patch.object(main.agreement_service, "create_agreement", new=AsyncMock(return_value=saved_agreement)) as create_agreement,
        ):
            result = await main.create_agreement(
                main.AgreementCreateRequest(application_id="application-1"),
                "Bearer tenant-token",
            )

        get_application.assert_awaited_once_with("application-1", "tenant-1", "tenant")
        args = create_agreement.await_args.args
        self.assertEqual(args[1:], ("tenant-1", "owner-1"))
        self.assertEqual(args[0]["property_id"], "property-1")
        self.assertEqual(args[0]["monthly_rent"], 2800000)
        self.assertEqual(result["agreement"]["id"], "agreement-1")

    async def test_create_rejects_unaccepted_application(self):
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value={"id": "tenant-1", "role": "tenant"})),
            patch.object(main.application_service, "get_application", new=AsyncMock(return_value={"status": "under_review"})),
            patch.object(main.agreement_service, "create_agreement", new=AsyncMock()) as create_agreement,
        ):
            with self.assertRaises(HTTPException) as error:
                await main.create_agreement(
                    main.AgreementCreateRequest(application_id="application-1"),
                    "Bearer tenant-token",
                )

        self.assertEqual(error.exception.status_code, 409)
        create_agreement.assert_not_awaited()

    async def test_signing_is_scoped_and_notifies_the_other_party(self):
        agreement = {
            "id": "agreement-1",
            "application_id": "application-1",
            "owner_id": "owner-1",
            "tenant_id": "tenant-1",
            "owner_agreed": True,
            "tenant_agreed": True,
            "status": "signed",
        }
        with (
            patch.object(main.auth_service, "get_session_user", new=AsyncMock(return_value={"id": "owner-1", "role": "owner"})),
            patch.object(main.agreement_service, "sign_agreement", new=AsyncMock(return_value=agreement)) as sign,
            patch.object(main.notification_service, "create_notification", new=AsyncMock()) as create_notification,
        ):
            result = await main.sign_agreement("agreement-1", "Bearer owner-token")

        sign.assert_awaited_once_with("agreement-1", "owner-1", "owner")
        self.assertEqual(result["agreement"]["status"], "signed")
        self.assertEqual(create_notification.await_args.args[0]["user_id"], "tenant-1")

    async def test_admin_cannot_sign_as_a_party(self):
        with patch.object(
            main.auth_service,
            "get_session_user",
            new=AsyncMock(return_value={"id": "admin-1", "role": "admin"}),
        ), patch.object(main.agreement_service, "sign_agreement", new=AsyncMock()) as sign:
            with self.assertRaises(HTTPException) as error:
                await main.sign_agreement("agreement-1", "Bearer admin-token")

        self.assertEqual(error.exception.status_code, 403)
        sign.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()