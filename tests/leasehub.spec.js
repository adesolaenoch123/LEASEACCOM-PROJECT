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

test("tenant application dashboard loads applications from the backend", async ({ page }) => {
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({ auth: {
            getSession: async () => ({ data: { session: { access_token: "backend-test-token" } }, error: null })
        } }) };`
    }));
    await page.route("http://127.0.0.1:8000/applications", async route => {
        expect(route.request().headers().authorization).toBe("Bearer backend-test-token");
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                applications: [{
                    id: "application-test-1",
                    property_title: "Backend test rental",
                    status: "submitted",
                    move_in_date: "2026-11-01"
                }],
                count: 1
            })
        });
    });
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "tenant-test",
            name: "Test Tenant",
            accountType: "tenant"
        }));
    });

    await page.goto("/tenant-dashboard.html");

    await expect(page.locator("#tenantApplicationList")).toContainText("Backend test rental");
});

test("apply form posts the tenant application and rental details to the backend", async ({ page }) => {
    let submittedPayload;
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({ auth: {
            getSession: async () => ({ data: { session: { access_token: "application-test-token" } }, error: null })
        } }) };`
    }));
    await page.route("http://127.0.0.1:8000/**", async route => {
        const request = route.request();
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization,content-type"
        };
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }

        expect(request.method()).toBe("POST");
        expect(request.headers().authorization).toBe("Bearer application-test-token");
        submittedPayload = request.postDataJSON();
        await route.fulfill({
            status: 201,
            contentType: "application/json",
            headers,
            body: JSON.stringify({
                application: {
                    id: "backend-application-1",
                    property_id: "1",
                    tenant_id: "tenant-test",
                    owner_id: "owner-test",
                    status: "submitted",
                    created_at: "2026-10-07T00:00:00Z"
                }
            })
        });
    });
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "tenant-test",
            name: "Test Tenant",
            email: "tenant@example.com",
            accountType: "tenant"
        }));
    });
    page.on("dialog", dialog => dialog.accept());

    await page.goto("/apply.html?property=1");
    await page.locator("#applicantName").fill("Test Tenant");
    await page.locator("#applicantEmail").fill("tenant@example.com");
    await page.locator("#applicantPhone").fill("08000000000");
    await page.locator("#occupants").fill("2");
    await page.locator("#moveInDate").fill("2026-11-01");
    await page.locator("#stayLength").selectOption({ label: "1 year" });
    await page.locator("#employmentStatus").selectOption({ label: "Employed" });
    await page.locator("#incomeRange").selectOption({ label: "₦100,000 – ₦250,000" });
    await page.locator("#applicationMessage").fill("I am interested in this property.");
    await page.getByRole("button", { name: "Submit Application" }).click();

    await expect(page).toHaveURL(/tenant-dashboard\.html$/);
    expect(submittedPayload).toMatchObject({
        property_id: "1",
        applicant_name: "Test Tenant",
        occupants: 2,
        stay_length: "1 year",
        income_range: "₦100,000 – ₦250,000",
        employment_status: "Employed"
    });
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

test("tenant notification panel loads and marks backend notifications read", async ({ page }) => {
    let isRead = false;
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({ auth: {
            getSession: async () => ({ data: { session: { access_token: "notification-test-token" } }, error: null })
        } }) };`
    }));
    await page.route("http://127.0.0.1:8000/**", async route => {
        const request = route.request();
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "authorization,content-type"
        };
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }
        expect(request.headers().authorization).toBe("Bearer notification-test-token");
        if (request.method() === "PATCH") isRead = true;
        await route.fulfill({
            contentType: "application/json",
            headers,
            body: JSON.stringify({
                count: 1,
                notifications: [{
                    id: "notification-test-1",
                    title: "Viewing accepted",
                    message: "Your viewing request was accepted.",
                    type: "success",
                    read: isRead
                }]
            })
        });
    });
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "tenant-notification-test",
            accountType: "tenant"
        }));
    });

    await page.goto("/tenant-dashboard.html");
    const bell = page.getByRole("button", { name: "Open notifications" });
    await expect(page.locator("[data-notifications-badge]")).toHaveText("1");
    await bell.click();
    await expect(page.locator("[data-notifications-list]")).toContainText("Viewing accepted");
    await page.getByRole("button", { name: "Mark read" }).click();

    await expect(page.locator("[data-notifications-badge]")).toBeHidden();
    await expect(page.getByRole("button", { name: "Read" })).toBeDisabled();
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

test("property details rental modal submits applications to the backend", async ({ page }) => {
    const propertyId = "4f814eed-2f4e-4bb0-b41c-647223d495bd";
    const listing = {
        id: propertyId,
        owner_id: "owner-user-id",
        owner_name: "Test Owner",
        verification_status: "approved",
        title: "Modal test apartment",
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
        description: "Approved test listing with enough detail for a rental application flow."
    };
    let submittedPayload;
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({
            from: () => ({
                select() { return this; },
                eq() { return this; },
                order() { return Promise.resolve({ data: [${JSON.stringify(listing)}], error: null }); }
            }),
            auth: { getSession: async () => ({ data: { session: { access_token: "modal-test-token" } }, error: null }) }
        }) };`
    }));
    await page.route("http://127.0.0.1:8000/**", async route => {
        const request = route.request();
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization,content-type"
        };
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }

        expect(request.headers().authorization).toBe("Bearer modal-test-token");
        submittedPayload = request.postDataJSON();
        await route.fulfill({
            status: 201,
            contentType: "application/json",
            headers,
            body: JSON.stringify({
                application: {
                    id: "backend-modal-application",
                    property_id: propertyId,
                    tenant_id: "tenant-modal-test",
                    owner_id: "owner-user-id",
                    status: "submitted"
                }
            })
        });
    });
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "tenant-modal-test",
            name: "Modal Tenant",
            email: "modal@example.com",
            accountType: "tenant"
        }));
    });
    page.on("dialog", dialog => dialog.accept());

    await page.goto(`/property-details.html?id=${propertyId}`);
    await page.locator("#applyRentBtn").click();
    await page.locator("#applicantName").fill("Modal Tenant");
    await page.locator("#applicantEmail").fill("modal@example.com");
    await page.locator("#applicantPhone").fill("08000000000");
    await page.locator("#moveInDate").fill("2026-11-01");
    await page.locator("#applicationMessage").fill("I would like to rent this apartment.");
    await page.getByRole("button", { name: "Submit Application" }).click();

    await expect(page.locator("#applicationModal")).not.toHaveClass(/active/);
    expect(submittedPayload).toMatchObject({
        property_id: propertyId,
        applicant_name: "Modal Tenant",
        applicant_phone: "08000000000",
        move_in_date: "2026-11-01"
    });
});

test("tenant viewing request is created and loaded from the backend", async ({ page }) => {
    const propertyId = "81f25c40-7b5d-4b2e-a2c1-9bc7826b4501";
    const listing = {
        id: propertyId,
        owner_id: "owner-user-id",
        owner_name: "Test Owner",
        verification_status: "approved",
        title: "Viewing test apartment",
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
        description: "Approved test listing with sufficient images and details for a viewing request."
    };
    let viewingStatus = "requested";
    let submittedPayload;
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({
            from: () => ({
                select() { return this; },
                eq() { return this; },
                order() { return Promise.resolve({ data: [${JSON.stringify(listing)}], error: null }); }
            }),
            auth: { getSession: async () => ({ data: { session: { access_token: "viewing-test-token" } }, error: null }) }
        }) };`
    }));
    await page.route("http://127.0.0.1:8000/**", async route => {
        const request = route.request();
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization,content-type"
        };
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }
        if (request.method() === "POST") {
            expect(request.headers().authorization).toBe("Bearer viewing-test-token");
            submittedPayload = request.postDataJSON();
            await route.fulfill({
                status: 201,
                contentType: "application/json",
                headers,
                body: JSON.stringify({ viewing_request: { id: "viewing-test-1", ...submittedPayload, status: viewingStatus } })
            });
            return;
        }
        await route.fulfill({
            contentType: "application/json",
            headers,
            body: JSON.stringify({
                count: 1,
                viewing_requests: [{
                    id: "viewing-test-1",
                    property_id: propertyId,
                    preferred_date: "2026-11-01",
                    preferred_time: "10:00 AM",
                    status: viewingStatus,
                    property: { title: "Viewing test apartment", location: "Lekki, Lagos" }
                }]
            })
        });
    });
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "tenant-viewing-test",
            name: "Viewing Tenant",
            email: "viewing@example.com",
            accountType: "tenant"
        }));
    });
    page.on("dialog", dialog => dialog.accept());

    await page.goto(`/property-details.html?id=${propertyId}`);
    await page.locator("#requestViewingBtn").click();
    await page.locator("#viewerName").fill("Viewing Tenant");
    await page.locator("#viewingDate").fill("2026-11-01");
    await page.locator("#viewingTime").selectOption({ label: "10:00 AM" });
    await page.getByRole("button", { name: "Request Viewing" }).click();

    expect(submittedPayload).toMatchObject({
        property_id: propertyId,
        preferred_date: "2026-11-01",
        preferred_time: "10:00 AM"
    });
    await page.goto("/viewing-requests.html");
    await expect(page.locator("#viewingRequests")).toContainText("Viewing test apartment");
    await expect(page.locator("#viewingRequests")).toContainText("10:00 AM");
});

test("owner viewing action updates status through the backend", async ({ page }) => {
    let viewingStatus = "requested";
    let patchPayload;
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({ auth: {
            getSession: async () => ({ data: { session: { access_token: "owner-viewing-token" } }, error: null })
        } }) };`
    }));
    await page.route("http://127.0.0.1:8000/**", async route => {
        const request = route.request();
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "authorization,content-type"
        };
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }
        expect(request.headers().authorization).toBe("Bearer owner-viewing-token");
        if (request.method() === "PATCH") {
            patchPayload = request.postDataJSON();
            viewingStatus = patchPayload.status;
        }
        await route.fulfill({
            contentType: "application/json",
            headers,
            body: JSON.stringify({
                count: 1,
                viewing_requests: [{
                    id: "viewing-owner-test",
                    property_id: "property-owner-test",
                    status: viewingStatus,
                    preferred_date: "2026-11-01",
                    preferred_time: "10:00 AM",
                    property: { title: "Owner viewing test property", location: "Lagos" }
                }]
            })
        });
    });
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "owner-viewing-test",
            name: "Test Owner",
            accountType: "owner"
        }));
    });

    await page.goto("/owner-dashboard.html");
    const acceptButton = page.locator('[data-viewing-status="accepted"]');
    await acceptButton.click();

    await expect(page.locator("#ownerViewingRequests .request-status")).toHaveText(/Accepted/i);
    expect(patchPayload).toEqual({ status: "accepted" });
});

test("accepted application creates and signs a backend rental agreement", async ({ page }) => {
    const application = {
        id: "application-agreement-test",
        property_id: "property-agreement-test",
        property_title: "Agreement test apartment",
        property_location: "Lekki, Lagos",
        property_price: 2800000,
        property_period: "year",
        owner_id: "owner-agreement-test",
        tenant_id: "tenant-agreement-test",
        applicant_name: "Agreement Tenant",
        applicant_email: "tenant@example.com",
        move_in_date: "2026-11-01",
        stay_length: "1 year",
        status: "accepted"
    };
    let storedAgreement = null;
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({ auth: {
            getSession: async () => ({ data: { session: { access_token: "agreement-test-token" } }, error: null })
        } }) };`
    }));
    await page.route("http://127.0.0.1:8000/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "authorization,content-type"
        };
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }
        expect(request.headers().authorization).toBe("Bearer agreement-test-token");
        if (url.pathname === "/applications/application-agreement-test") {
            await route.fulfill({ contentType: "application/json", headers, body: JSON.stringify({ application }) });
            return;
        }
        if (url.pathname === "/agreements" && request.method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                headers,
                body: JSON.stringify({ agreements: storedAgreement ? [storedAgreement] : [] })
            });
            return;
        }
        if (url.pathname === "/agreements" && request.method() === "POST") {
            storedAgreement = {
                id: "agreement-backend-test",
                application_id: application.id,
                property_id: application.property_id,
                owner_id: application.owner_id,
                tenant_id: application.tenant_id,
                monthly_rent: application.property_price,
                property_period: application.property_period,
                start_date: application.move_in_date,
                status: "pending",
                owner_agreed: false,
                tenant_agreed: false
            };
            expect(request.postDataJSON().application_id).toBe(application.id);
            await route.fulfill({
                status: 201,
                contentType: "application/json",
                headers,
                body: JSON.stringify({ agreement: storedAgreement })
            });
            return;
        }
        if (url.pathname === "/agreements/agreement-backend-test/sign") {
            storedAgreement = { ...storedAgreement, tenant_agreed: true, status: "pending" };
            await route.fulfill({
                contentType: "application/json",
                headers,
                body: JSON.stringify({ agreement: storedAgreement })
            });
            return;
        }
        throw new Error(`Unexpected agreement API request: ${request.method()} ${url.pathname}`);
    });
    await page.addInitScript(() => {
        localStorage.setItem("leasehubCurrentUser", JSON.stringify({
            id: "tenant-agreement-test",
            name: "Agreement Tenant",
            email: "tenant@example.com",
            accountType: "tenant"
        }));
    });

    await page.goto("/rental-agreement.html?applicationId=application-agreement-test");

    await expect(page.locator("#agreementContent")).toContainText("Agreement test apartment");
    await expect(page.locator("#ownerAgreeBtn")).toBeHidden();
    await page.getByRole("button", { name: "Tenant Agrees" }).click();
    await expect(page.getByRole("button", { name: "Tenant Agreed" })).toBeDisabled();
    expect(storedAgreement.tenant_agreed).toBe(true);
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
