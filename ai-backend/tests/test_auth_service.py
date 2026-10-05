import unittest
from types import SimpleNamespace
from unittest.mock import patch

from services.auth_service import AuthService


class AuthServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_authentication_is_closed_when_supabase_is_unconfigured(self):
        with patch("services.auth_service.settings", SimpleNamespace(
            SUPABASE_URL="",
            SUPABASE_ANON_KEY="",
            ALLOW_DEMO_AUTH=False,
        )):
            service = AuthService()
            self.assertIsNone(await service.get_session_user("Bearer demo-owner-token"))

    async def test_demo_auth_requires_exact_token_and_explicit_opt_in(self):
        with patch("services.auth_service.settings", SimpleNamespace(
            SUPABASE_URL="",
            SUPABASE_ANON_KEY="",
            ALLOW_DEMO_AUTH=True,
        )):
            service = AuthService()
            self.assertEqual(
                await service.get_session_user("Bearer demo-owner-token"),
                {"id": "demo-owner", "email": "owner@leasehub.local", "role": "owner"},
            )
            self.assertIsNone(await service.get_session_user("Bearer made-up-admin-token"))

    async def test_invalid_supabase_token_never_falls_back_to_demo_user(self):
        client = SimpleNamespace(auth=SimpleNamespace(get_user=unittest.mock.Mock(side_effect=ValueError("invalid token"))))
        settings = SimpleNamespace(
            SUPABASE_URL="https://example.supabase.co",
            SUPABASE_ANON_KEY="public-key",
            ALLOW_DEMO_AUTH=True,
        )
        with patch("services.auth_service.settings", settings), patch(
            "services.auth_service.create_client", return_value=client
        ):
            service = AuthService()
            self.assertIsNone(await service.get_session_user("Bearer demo-admin-token"))


if __name__ == "__main__":
    unittest.main()