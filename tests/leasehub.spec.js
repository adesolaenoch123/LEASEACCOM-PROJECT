const { test, expect } = require("@playwright/test");

const pendingProperty = {
    id: 9001,
    title: "Test Pending Apartment",
    type: "Apartment",
    location: "Lekki Phase 1, Lagos",
    city: "Lagos",
    price: 2500000,
    period: "year",
    bedrooms: 2,
    bathrooms: 2,
    verified: false,
    verificationStatus: "pending",
    image: "https://example.com/test-property.jpg"
};

test("admin approval updates the shared public property store", async ({ page }) => {
    await page.addInitScript((property) => {
        localStorage.setItem("leasehubProperties", JSON.stringify([property]));
        localStorage.removeItem("leasehubAdminProperties");
    }, pendingProperty);

    await page.goto("/admin/admin.html");
    await page.getByLabel("Email").fill("admin@leasehub.ng");
    await page.getByLabel("Access code").fill("CHANGE-ME");
    await page.getByRole("button", { name: /Enter staff portal/i }).click();
    await page.getByRole("link", { name: "Properties" }).click();

    page.once("dialog", dialog => dialog.accept());
    await page.locator('#propertiesTable [data-prop="9001"][data-prop-action="approve"]').click();

    await expect.poll(() => page.evaluate(() => {
        const properties = JSON.parse(localStorage.getItem("leasehubProperties"));
        return properties[0].verificationStatus;
    })).toBe("approved");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("leasehubAdminProperties"))).toBeNull();
});

test("tenant dashboard reads saved properties from the shared saved store", async ({ page }) => {
    await page.addInitScript(() => {
        const user = {
            id: "tenant-test",
            name: "Test Tenant",
            email: "tenant@example.com",
            accountType: "tenant",
            savedProperties: [1]
        };
        localStorage.setItem("leasehubCurrentUser", JSON.stringify(user));
        localStorage.removeItem("savedProperties");
    });

    await page.goto("/tenant-dashboard.html");
    await expect(page.locator("#savedCount")).toHaveText("1");
    await expect.poll(() => page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem("leasehubCurrentUser"));
        return user.savedProperties;
    })).toEqual([1]);
});

test("notification panels are accessible on mobile app screens", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "tenant-mobile-test",
            name: "Mobile Tenant",
            accountType: "tenant"
        }));
    });
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ["/", "/tenant-dashboard.html"]) {
        await page.goto(route);
        const bell = page.getByRole("button", { name: "Open notifications" });
        await expect(bell).toBeVisible();
        await bell.click();

        const panel = page.locator(".leasehub-notification-panel");
        await expect(panel).toHaveClass(/is-open/);
        await expect.poll(() => panel.locator(".leasehub-notification-panel__dropdown").evaluate((element) =>
            getComputedStyle(element).position
        )).toBe("fixed");
        await expect.poll(() => page.evaluate(() =>
            document.documentElement.scrollWidth <= window.innerWidth
        )).toBe(true);
    }

    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "owner-mobile-test",
            name: "Mobile Owner",
            accountType: "owner"
        }));
    });
    await page.goto("/owner-dashboard.html");
    const ownerBell = page.locator("#ownerNotifBtn");
    await expect(ownerBell).toBeVisible();
    await ownerBell.click();
    await expect(page.locator("#ownerNotifPanel")).toBeVisible();
    await expect.poll(() => page.locator("#ownerNotifPanel").evaluate((element) =>
        getComputedStyle(element).position
    )).toBe("fixed");
});

test("login uses Supabase Auth without caching the password", async ({ page }) => {
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({ auth: {
            signInWithPassword: async ({ email }) => ({
                data: {
                    user: { id: "auth-tenant-1", email, user_metadata: { account_type: "tenant", full_name: "Auth Tenant" } },
                    session: { access_token: "signed-test-access-token" }
                },
                error: null
            }),
            getSession: async () => ({ data: { session: { access_token: "signed-test-access-token" } }, error: null }),
            signOut: async () => ({ error: null })
        } }) };`
    }));

    await page.goto("/login.html");
    await page.locator("#loginEmail").fill("tenant@example.com");
    await page.locator("#loginPassword").fill("do-not-store-this-password");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page).toHaveURL(/tenant-dashboard\.html$/);

    const cachedUser = await page.evaluate(() => JSON.parse(localStorage.getItem("leasehubCurrentUser")));
    expect(cachedUser.id).toBe("auth-tenant-1");
    expect(cachedUser.password).toBeUndefined();
    expect(await page.evaluate(() => localStorage.getItem("leasehub_session_token"))).toBe("signed-test-access-token");
    expect(await page.evaluate(() => localStorage.getItem("leasehubUsers"))).toBeNull();
});

test("property search filters the public catalog", async ({ page }) => {
    await page.goto("/properties.html");
    const search = page.locator("#marketSearch");

    await search.fill("Lekki");
    await page.locator("#marketSearchBtn").click();

    await expect(page.locator("#marketplaceProperties .property-card").first()).toBeVisible();
    await expect(page.locator("#marketplaceProperties .property-card").first()).toContainText(/Lekki/i);
});

test("approved Supabase UUID listings render and open their details", async ({ page }) => {
    const propertyId = "4f814eed-4f2e-4bb0-b41c-647223d495bd";
    const listing = {
        id: propertyId,
        owner_id: "owner-user-id",
        owner_name: "Test Owner",
        verification_status: "approved",
        title: "Live Supabase Apartment",
        city: "Lagos",
        type: "Apartment",
        price: 2500000,
        period: "year",
        location: "Lekki, Lagos",
        image: "https://example.com/listing.jpg",
        images: [
            "https://example.com/listing-1.jpg",
            "https://example.com/listing-2.jpg",
            "https://example.com/listing-3.jpg",
            "https://example.com/listing-4.jpg"
        ],
        bedrooms: 2,
        bathrooms: 2,
        description: "Approved live test listing for the LeaseHub marketplace."
    };
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({
            from: () => ({
                select() { return this; },
                eq() { return this; },
                order() { return Promise.resolve({ data: [${JSON.stringify(listing)}], error: null }); }
            }),
            auth: { getSession: async () => ({ data: { session: null }, error: null }) }
        }) };`
    }));

    await page.goto("/properties.html");
    const card = page.locator("#marketplaceProperties .property-card").filter({
        hasText: "Live Supabase Apartment"
    });
    await expect(card).toContainText("Live Supabase Apartment");
    await card.click();
    await expect(page).toHaveURL(new RegExp(`property-details\\.html\\?id=${propertyId}`));
    await expect(page.locator("#propertyDetails")).toContainText("Live Supabase Apartment");
});

test("owner dashboard shows the house tour and subscription plans", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "owner-test",
            name: "Test Owner",
            email: "owner@example.com",
            accountType: "owner"
        }));
    });
    await page.goto("/owner-dashboard.html");

    const video = page.locator(".owner-featured-video");
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThan(0);
    await expect(page.locator("#ownerPlanOptions .owner-plan-option")).toHaveCount(3);
    await expect(page.locator("#ownerPlanOptions")).toContainText("₦20,000");

    await page.getByRole("button", { name: "Subscribe now" }).click();
    await expect(page.locator("#ownerPlanNotice")).toContainText("checkout is not connected yet");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.locator("#ownerPlanOptions").evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    )).toBe(1);
    await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth
    )).toBe(true);
});
