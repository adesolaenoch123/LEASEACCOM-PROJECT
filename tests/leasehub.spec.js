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

test("verified owner can open the add-property page after backend approval", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__verifiedOwnerSupabase;"
    }));
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-refresh-test",
            accountType: "owner",
            verificationStatus: "unverified",
            ownerVerificationStatus: "unverified"
        }));
        const profile = {
            id: "owner-refresh-test",
            account_type: "owner",
            verification_status: "verified",
            full_name: "Verified Owner",
            plan: "free",
            promo_type: "business_90",
            promo_ends_at: "2027-02-16T00:00:00Z"
        };
        const builder = {
            select() { return this; },
            eq() { return this; },
            maybeSingle() { return Promise.resolve({ data: profile, error: null }); }
        };
        window.__verifiedOwnerSupabase = {
            createClient: () => window.__verifiedOwnerSupabase,
            auth: {
                getUser: async () => ({
                    data: { user: { id: "owner-refresh-test", email: "owner@example.com" } },
                    error: null
                })
            },
            from: () => builder
        };
        window.supabase = { createClient: () => window.__verifiedOwnerSupabase };
    });

    await page.goto("/add-property.html");
    await expect(page).toHaveURL(/add-property\.html$/);
    await expect(page.locator("#addPropertyForm")).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
        return JSON.parse(localStorage.getItem("leaseaccomCurrentUser")).verificationStatus;
    })).toBe("verified");
    const owner = await page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomCurrentUser")));
    expect(owner.promoType).toBe("business_90");
    expect(await page.evaluate(() => window.LeaseAccomPlans.getPlanLimits(
        JSON.parse(localStorage.getItem("leaseaccomCurrentUser"))
    ).maxListings)).toBe(15);
});

test("owner verification form uploads documents and submits a cloud request", async ({ page }) => {
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__ownerSubmissionSupabase;"
    }));
    await page.addInitScript(() => {
        const rows = {
            profiles: [{
                id: "owner-submit-1",
                account_type: "owner",
                account_status: "active",
                verification_status: "unverified",
                full_name: "New Owner",
                phone: "08012345678"
            }],
            owner_verifications: []
        };
        function query(table) {
            const filters = [];
            const builder = {
                select() { return this; },
                eq(key, value) { filters.push([key, String(value)]); return this; },
                order() { return this; },
                limit() { return this; },
                insert(values) { this.insertValues = values; return this; },
                update(values) { this.updateValues = values; return this; },
                matching() {
                    return (rows[table] || []).filter(row =>
                        filters.every(([key, value]) => String(row[key]) === value)
                    );
                },
                apply() {
                    if (this.insertValues) {
                        const values = Array.isArray(this.insertValues) ? this.insertValues : [this.insertValues];
                        rows[table] = rows[table] || [];
                        values.forEach(value => rows[table].push(Object.assign({ id: "owner-request-1" }, value)));
                    }
                    if (this.updateValues) this.matching().forEach(row => Object.assign(row, this.updateValues));
                },
                maybeSingle() {
                    this.apply();
                    return Promise.resolve({ data: this.matching()[0] || null, error: null });
                },
                then(resolve, reject) {
                    this.apply();
                    return Promise.resolve({ data: this.matching(), error: null }).then(resolve, reject);
                }
            };
            return builder;
        }
        window.__ownerSubmissionSupabase = {
            testRows: rows,
            createClient: () => window.__ownerSubmissionSupabase,
            auth: {
                getUser: async () => ({ data: { user: { id: "owner-submit-1", email: "new-owner@example.com" } }, error: null })
            },
            from: query,
            storage: {
                from: () => ({
                    upload: async path => ({ data: { path: path }, error: null })
                })
            }
        };
    });

    await page.goto("/owner-verification.html");
    await page.locator("#ovFullName").fill("New Owner");
    await page.locator("#ovPhone").fill("08012345678");
    await page.locator("#ovEmail").fill("new-owner@example.com");
    await page.locator("#ovRole").selectOption("individual_owner");
    await page.locator("#ovCity").fill("Lagos");
    await page.locator("#ovState").selectOption({ label: "Lagos" });
    await page.locator("#ovAddress").fill("10 Test Street, Lagos");
    await page.locator('[data-next="2"]').click();
    await page.locator("#ovIdType").selectOption("nin");
    await page.locator("#ovIdNumber").fill("12345678901");
    await page.locator("#ovIdFile").setInputFiles({
        name: "identity.png",
        mimeType: "image/png",
        buffer: Buffer.from("identity document")
    });
    await page.locator('[data-next="3"]').click();
    await page.locator("#ovProofType").selectOption("title_deed");
    await page.locator("#ovProofFile").setInputFiles({
        name: "ownership.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 test document")
    });
    await page.locator('[data-next="4"]').click();
    await page.locator("#ovConsent").check();
    await page.locator("#ovForm").evaluate(form => form.requestSubmit());

    await expect.poll(() => page.evaluate(() => {
        return window.__ownerSubmissionSupabase.testRows.owner_verifications.length;
    })).toBe(1);
    const saved = await page.evaluate(() => ({
        request: window.__ownerSubmissionSupabase.testRows.owner_verifications[0],
        profile: window.__ownerSubmissionSupabase.testRows.profiles[0],
        user: JSON.parse(localStorage.getItem("leaseaccomCurrentUser"))
    }));
    expect(saved.request.owner_id).toBe("owner-submit-1");
    expect(saved.request.status).toBe("pending");
    expect(saved.request.id_file_path).toContain("owner-submit-1/id-");
    expect(saved.request.proof_file_path).toContain("owner-submit-1/proof-");
    expect(saved.profile.verification_status).toBe("pending");
    expect(saved.profile.verified_at).toBeNull();
    expect(saved.user.verificationStatus).toBe("pending");
    await expect(page.locator("#ovBanner")).toContainText("Verification pending");
});

test("pending and rejected cloud owners cannot open the add-property form despite a verified cache", async ({ page }) => {
    test.setTimeout(60_000);
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__pendingOwnerSupabase;"
    }));
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-pending-1",
            accountType: "owner",
            verificationStatus: "verified",
            ownerVerificationStatus: "verified",
            verified: true
        }));
        const profile = {
            id: "owner-pending-1",
            account_type: "owner",
            account_status: "active",
            verification_status: localStorage.getItem("testOwnerVerificationStatus") || "pending"
        };
        function query(table) {
            return {
                select() { return this; },
                eq() { return this; },
                order() { return this; },
                limit() { return this; },
                maybeSingle() {
                    return Promise.resolve({
                        data: table === "profiles" ? profile : null,
                        error: null
                    });
                }
            };
        }
        window.__pendingOwnerSupabase = {
            createClient: () => window.__pendingOwnerSupabase,
            auth: {
                getUser: async () => ({ data: { user: { id: "owner-pending-1" } }, error: null })
            },
            testProfile: profile,
            from: query
        };
    });

    await page.goto("/add-property.html");
    await expect(page).toHaveURL(/owner-verification\.html\?need=list$/);
    await expect(page.locator("#ovBanner")).toContainText("Verification pending");
    await expect(page.locator("#ovSubmitBtn")).toBeDisabled();
    await page.evaluate(() => {
        localStorage.setItem("testOwnerVerificationStatus", "rejected");
        window.__pendingOwnerSupabase.testProfile.verification_status = "rejected";
    });
    await page.goto("/add-property.html");
    await expect(page).toHaveURL(/owner-verification\.html\?need=list$/);
    await expect(page.locator("#ovBanner")).toContainText("Verification rejected");
    await expect(page.locator("#ovSubmitBtn")).toBeEnabled();
});

test("rejected owner sees the admin reason and can resubmit", async ({ page }) => {
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__rejectedOwnerSupabase;"
    }));
    await page.addInitScript(() => {
        const rows = {
            profiles: [{
                id: "owner-rejected-1",
                account_type: "owner",
                account_status: "active",
                verification_status: "rejected"
            }],
            owner_verifications: [{
                id: "rejected-request-1",
                owner_id: "owner-rejected-1",
                status: "rejected",
                review_note: "Please upload a clearer ownership document.",
                submitted_at: "2026-11-18T12:00:00Z"
            }]
        };
        function query(table) {
            const filters = [];
            return {
                select() { return this; },
                eq(key, value) { filters.push([key, String(value)]); return this; },
                order() { return this; },
                limit() { return this; },
                maybeSingle() {
                    const match = (rows[table] || []).find(row =>
                        filters.every(([key, value]) => String(row[key]) === value)
                    );
                    return Promise.resolve({ data: match || null, error: null });
                }
            };
        }
        window.__rejectedOwnerSupabase = {
            createClient: () => window.__rejectedOwnerSupabase,
            auth: {
                getUser: async () => ({ data: { user: { id: "owner-rejected-1" } }, error: null })
            },
            from: query
        };
    });

    await page.goto("/owner-verification.html");
    await expect(page.locator("#ovBanner")).toContainText("Verification rejected");
    await expect(page.locator("#ovBanner")).toContainText("Please upload a clearer ownership document.");
    await expect(page.locator("#ovSubmitBtn")).toBeEnabled();
});

test("landlords cannot open the admin owner-verification queue", async ({ page }) => {
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__ownerAccessSupabase;"
    }));
    await page.addInitScript(() => {
        const builder = {
            select() { return this; },
            eq() { return this; },
            maybeSingle() {
                return Promise.resolve({ data: { account_type: "owner" }, error: null });
            }
        };
        window.__ownerAccessSupabase = {
            createClient: () => window.__ownerAccessSupabase,
            auth: {
                getUser: async () => ({
                    data: { user: { id: "owner-access-test", email: "owner@example.com" } },
                    error: null
                }),
                signOut: async () => ({ error: null })
            },
            from: () => builder
        };
        window.supabase = { createClient: () => window.__ownerAccessSupabase };
    });

    await page.goto("/admin-owner-verification.html");
    await expect(page).toHaveURL(/owner-dashboard\.html$/);
});

test("admin owner-verification queue replaces cached requests with cloud empty state", async ({ page }) => {
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__emptyOwnerQueueSupabase;"
    }));
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomOwnerVerifications", JSON.stringify([{
            id: "local-only-request",
            email: "local@example.com",
            status: "pending",
            application: { fullName: "Local Demo Applicant" }
        }]));
        function query(table) {
            return {
                select() { return this; },
                eq() { return this; },
                order() { return this; },
                limit() { return this; },
                maybeSingle() {
                    return Promise.resolve({
                        data: table === "profiles" ? { account_type: "admin", account_status: "active" } : null,
                        error: null
                    });
                },
                then(resolve, reject) {
                    return Promise.resolve({ data: [], error: null }).then(resolve, reject);
                }
            };
        }
        window.__emptyOwnerQueueSupabase = {
            createClient: () => window.__emptyOwnerQueueSupabase,
            auth: {
                getUser: async () => ({ data: { user: { id: "admin-empty-queue" } }, error: null })
            },
            from: query
        };
    });

    await page.goto("/admin-owner-verification.html");
    await expect(page.locator("#admOwnerQueue")).toContainText("No applications in this filter.");
    await expect(page.locator("#admOwnerQueue")).not.toContainText("Local Demo Applicant");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomOwnerVerifications")))).toEqual([]);
});

test("admin owner approval grants the promo without replacing the admin session", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = { createClient: () => window.__adminOwnerVerifySupabase };"
    }));
    await page.route("**/JS/leaseaccom-cloud.js", route => route.fulfill({
        contentType: "application/javascript",
        body: `
            let ownerStatus = "pending";
            const ownerVerification = {
                id: "cloud-owner-promo-test",
                owner_id: "owner-promo-test",
                email: "owner@example.com",
                status: "pending",
                full_name: "Promo Owner"
            };
            window.LeaseAccomCloud = {
                listOwnerVerifications: async () => ({
                    ok: true,
                    data: [Object.assign({}, ownerVerification, { status: ownerStatus })]
                }),
                reviewOwnerVerification: async (id, status) => {
                    ownerStatus = status;
                    return { ok: true, data: ownerVerification };
                }
            };
        `
    }));
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "admin-promo-test",
            email: "admin@example.com",
            accountType: "admin"
        }));
        localStorage.setItem("leaseaccomUsers", JSON.stringify([]));
        function query(table) {
            let userId = null;
            return {
                select() { return this; },
                update() { return this; },
                eq(key, value) { if (key === "id") userId = value; return this; },
                order() { return this; },
                limit() { return this; },
                maybeSingle() {
                    return Promise.resolve({
                        data: table === "profiles" && userId === "admin-promo-test"
                            ? { account_type: "admin" }
                            : table === "profiles" && userId === "owner-promo-test"
                                ? { id: userId, account_type: "owner", plan: "free" }
                                : null,
                        error: null
                    });
                },
                then(resolve, reject) {
                    return Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject);
                }
            };
        }
        window.__adminOwnerVerifySupabase = {
            createClient: () => window.__adminOwnerVerifySupabase,
            auth: {
                getUser: async () => ({
                    data: { user: { id: "admin-promo-test", email: "admin@example.com" } },
                    error: null
                })
            },
            from: query
        };
    });
    page.on("dialog", dialog => dialog.accept());

    await page.goto("/admin-owner-verification.html");
    await page.locator('[data-approve="cloud-owner-promo-test"]').click({ force: true });

    const result = await page.evaluate(() => ({
        owner: JSON.parse(localStorage.getItem("leaseaccomUsers"))[0],
        current: JSON.parse(localStorage.getItem("leaseaccomCurrentUser")),
        plan: window.LeaseAccomPlans.getEffectivePlanId(JSON.parse(localStorage.getItem("leaseaccomUsers"))[0]),
        limits: window.LeaseAccomPlans.getPlanLimits(JSON.parse(localStorage.getItem("leaseaccomUsers"))[0])
    }));
    expect(result.owner.verificationStatus).toBe("verified");
    expect(result.owner.ownerVerificationStatus).toBe("verified");
    expect(result.owner.verified).toBe(true);
    expect(result.owner.verifiedAt).toBeTruthy();
    expect(["business_90", "enterprise_founding"]).toContain(result.owner.promoType);
    expect(result.plan).toBe(result.owner.promoType === "enterprise_founding" ? "enterprise" : "business");
    expect(result.limits.maxListings).toBe(result.plan === "enterprise" ? 30 : 15);
    expect(result.current.id).toBe("admin-promo-test");
});

test("owner dashboard trusts the authenticated Supabase profile over browser role data", async ({ page }) => {
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__roleGateSupabase;"
    }));
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "role-gate-test",
            accountType: "owner"
        }));
        const profile = {
            id: "role-gate-test",
            full_name: "Test Tenant",
            account_type: "tenant",
            account_status: "active"
        };
        function query() {
            return {
                select() { return this; },
                eq() { return this; },
                order() { return this; },
                limit() { return this; },
                range() { return this; },
                maybeSingle() { return Promise.resolve({ data: profile, error: null }); },
                single() { return Promise.resolve({ data: profile, error: null }); },
                then(resolve, reject) {
                    return Promise.resolve({ data: [], error: null }).then(resolve, reject);
                }
            };
        }
        window.__roleGateSupabase = {
            createClient() { return this; },
            auth: {
                getUser: async () => ({
                    data: { user: { id: "role-gate-test", email: "tenant@example.com" } },
                    error: null
                })
            },
            from: query
        };
        window.supabase = { createClient: () => window.__roleGateSupabase };
    });

    await page.goto("/owner-dashboard.html");
    await expect(page).toHaveURL(/tenant-dashboard\.html$/);
});

test("admin approval updates the shared public property Property Page ", async ({ page }) => {
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__adminApprovalSupabase;"
    }));
    await page.addInitScript((property) => {
        const rows = {
            profiles: [{ id: "admin-1", account_type: "admin", full_name: "Test Admin", email: "admin@example.com" }],
            properties: [{
                id: property.id,
                title: property.title,
                property_type: property.type,
                location: property.location,
                city: property.city,
                price: property.price,
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                owner_id: "owner-1",
                verification_status: "pending",
                listing_status: "pending",
                cover_image: property.image
            }],
            platform_settings: [], owner_verifications: [], viewings: [], applications: [], payments: [],
            subscriptions: [], reports: [], audit_logs: [], email_queue: [], notifications: [],
            conversations: [], messages: []
        };
        function query(table) {
            const filters = [];
            const builder = {
                select() { return this; },
                eq(key, value) { filters.push([key, String(value)]); return this; },
                order() { return this; },
                limit() { return this; },
                range() { return this; },
                matching() {
                    return (rows[table] || []).filter(row =>
                        filters.every(([key, value]) => String(row[key]) === value)
                    );
                },
                maybeSingle() { return Promise.resolve({ data: this.matching()[0] || null, error: null }); },
                update(values) {
                    this.updateValues = values;
                    return this;
                },
                insert(value) {
                    rows[table] = rows[table] || [];
                    rows[table].push(value);
                    return Promise.resolve({ data: value, error: null });
                },
                then(resolve, reject) {
                    if (this.updateValues) {
                        this.matching().forEach(row => Object.assign(row, this.updateValues));
                    }
                    return Promise.resolve({ data: this.matching(), error: null }).then(resolve, reject);
                }
            };
            return builder;
        }
        window.__adminApprovalSupabase = {
            testRows: rows,
            createClient: () => window.__adminApprovalSupabase,
            auth: {
                getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } }, error: null }),
                signInWithPassword: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } }, error: null }),
                signOut: async () => ({ error: null })
            },
            from: query
        };
        window.supabase = { createClient: () => window.__adminApprovalSupabase };
    }, pendingProperty);

    await page.goto("/admin/admin.html");
    await expect(page.locator("#adminApp")).toBeVisible();
    await page.getByRole("link", { name: "Properties" }).click();

    await page.locator('#propertiesTable [data-prop-approve="9001"]').click();

    await expect.poll(() => page.evaluate(() => {
        return window.__adminApprovalSupabase.testRows.properties[0].verification_status;
    })).toBe("approved");
    expect(await page.evaluate(() => window.__adminApprovalSupabase.testRows.properties[0].listing_status)).toBe("live");
});

test("admin owner approval persists verification timestamp and launch promo", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__adminVerificationSupabase;"
    }));
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "admin-verify-1",
            email: "admin@example.com",
            accountType: "admin"
        }));
        const rows = {
            profiles: [
                { id: "admin-verify-1", account_type: "admin", account_status: "active", full_name: "Test Admin" },
                { id: "owner-verify-1", account_type: "owner", account_status: "active", plan: "free", verification_status: "pending" }
            ],
            properties: [],
            owner_verifications: [{
                id: "verification-1",
                owner_id: "owner-verify-1",
                email: "owner@example.com",
                full_name: "Verified Owner",
                status: "pending",
                submitted_at: "2026-11-18T12:00:00Z"
            }],
            viewings: [], applications: [], payments: [], subscriptions: [], reports: [],
            audit_logs: [], email_queue: [], notifications: [], conversations: [], messages: []
        };
        function query(table) {
            const filters = [];
            const builder = {
                select() { return this; },
                eq(key, value) { filters.push([key, String(value)]); return this; },
                order() { return this; },
                range() { return this; },
                limit() { return this; },
                update(values) { this.updateValues = values; return this; },
                insert(values) { this.insertValues = values; return this; },
                matching() {
                    return (rows[table] || []).filter(row =>
                        filters.every(([key, value]) => String(row[key]) === value)
                    );
                },
                apply() {
                    if (this.updateValues) this.matching().forEach(row => Object.assign(row, this.updateValues));
                    if (this.insertValues) {
                        const values = Array.isArray(this.insertValues) ? this.insertValues : [this.insertValues];
                        rows[table] = rows[table] || [];
                        rows[table].push(...values);
                    }
                },
                maybeSingle() {
                    this.apply();
                    return Promise.resolve({ data: this.matching()[0] || null, error: null });
                },
                then(resolve, reject) {
                    this.apply();
                    return Promise.resolve({ data: this.matching(), count: this.matching().length, error: null }).then(resolve, reject);
                }
            };
            return builder;
        }
        window.__adminVerificationSupabase = {
            testRows: rows,
            createClient: () => window.__adminVerificationSupabase,
            auth: {
                getUser: async () => ({ data: { user: { id: "admin-verify-1", email: "admin@example.com" } }, error: null }),
                signOut: async () => ({ error: null })
            },
            from: query
        };
    });

    await page.goto("/admin/admin.html");
    await expect(page.locator("#adminApp")).toBeVisible();
    await page.getByRole("link", { name: "Verification" }).click();
    await page.locator('#verificationTable [data-ver-approve="verification-1"]').click();

    await expect.poll(() => page.evaluate(() => {
        return window.__adminVerificationSupabase.testRows.profiles.find(row => row.id === "owner-verify-1").verification_status;
    })).toBe("verified");
    const saved = await page.evaluate(() => ({
        request: window.__adminVerificationSupabase.testRows.owner_verifications[0],
        profile: window.__adminVerificationSupabase.testRows.profiles.find(row => row.id === "owner-verify-1")
    }));
    expect(saved.request.status).toBe("verified");
    expect(saved.profile.verified_at).toBeTruthy();
    expect(saved.profile.promo_type).toMatch(/business_90|enterprise_founding/);
    expect(saved.profile.promo_ends_at).toBeTruthy();
});

test("non-admin Supabase profile cannot open the admin dashboard", async ({ page }) => {
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__nonAdminSupabase;"
    }));
    await page.addInitScript(() => {
        window.__nonAdminSupabase = {
            createClient: () => window.__nonAdminSupabase,
            auth: {
                getUser: async () => ({ data: { user: { id: "owner-not-admin" } }, error: null }),
                signOut: async () => ({ error: null })
            },
            from: () => ({
                select() { return this; },
                eq() { return this; },
                maybeSingle: async () => ({
                    data: { account_type: "owner", account_status: "active" },
                    error: null
                })
            })
        };
    });

    await page.goto("/admin/admin.html");
    await expect(page.locator("#adminLoginError")).toContainText("This account is not an active admin");
    await expect(page.locator("#adminApp")).toBeHidden();
});

test("admin can review viewing requests and tenant-owner conversations on mobile", async ({ page }) => {
    await page.route(/supabase-js/, route => route.fulfill({
        contentType: "application/javascript",
        body: "window.supabase = window.__adminTestSupabase;"
    }));
    await page.addInitScript(() => {
        const rows = {
            profiles: [
                { id: "admin-1", account_type: "admin", full_name: "Test Admin", email: "admin@example.com" },
                { id: "tenant-1", account_type: "tenant", full_name: "A Tenant", email: "tenant@example.com" },
                { id: "owner-1", account_type: "owner", full_name: "An Owner", email: "owner@example.com" }
            ],
            properties: [{ id: "property-1", title: "Test rental", owner_id: "owner-1", location: "Lagos", price: 1800000, verification_status: "approved" }],
            owner_verifications: [],
            viewings: [{
                id: "viewing-1", property_id: "property-1", tenant_id: "tenant-1", owner_id: "owner-1",
                status: "requested", preferred_date: "2026-11-10", preferred_time: "10:00 AM",
                message: "I would like to view this apartment.", created_at: "2026-11-03T10:00:00Z"
            }],
            applications: [{
                id: "application-1", property_id: "property-1", tenant_id: "tenant-1", owner_id: "owner-1",
                status: "submitted", applicant_name: "A Tenant", message: "Please review my application.",
                created_at: "2026-11-03T11:00:00Z"
            }],
            payments: [], subscriptions: [], reports: [], audit_logs: [], email_queue: [],
            notifications: [{
                id: "notification-1", user_id: "tenant-1", title: "Viewing accepted",
                message: "The owner accepted your viewing request.", type: "info",
                read: false, link: "viewing-requests.html", created_at: "2026-11-03T12:05:00Z"
            }],
            conversations: [{
                id: "conversation-1", property_id: "property-1", tenant_id: "tenant-1", owner_id: "owner-1",
                subject: "Test rental", created_at: "2026-11-03T09:00:00Z", last_message_at: "2026-11-03T12:00:00Z"
            }],
            messages: [
                { id: "message-1", conversation_id: "conversation-1", sender_id: "tenant-1", body: "Is the apartment still available?", created_at: "2026-11-03T09:10:00Z" },
                { id: "message-2", conversation_id: "conversation-1", sender_id: "owner-1", body: "Yes, we can arrange a viewing.", created_at: "2026-11-03T09:20:00Z" }
            ],
            platform_settings: []
        };
        function query(table) {
            const filters = [];
            const builder = {
                select() { return this; },
                eq(key, value) { filters.push([key, String(value)]); return this; },
                order() { return this; },
                limit() { return this; },
                range(start, end) { this.start = start; this.end = end; return this; },
                matching() {
                    const matched = (rows[table] || []).filter(row =>
                        filters.every(([key, value]) => String(row[key]) === value)
                    );
                    return this.start == null ? matched : matched.slice(this.start, this.end + 1);
                },
                maybeSingle() { return Promise.resolve({ data: this.matching()[0] || null, error: null }); },
                then(resolve, reject) {
                    return Promise.resolve({ data: this.matching(), error: null }).then(resolve, reject);
                }
            };
            return builder;
        }
        window.__adminTestSupabase = {
            testRows: rows,
            createClient: () => window.__adminTestSupabase,
            auth: {
                getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } }, error: null }),
                signOut: async () => ({ error: null })
            },
            from: query
        };
        window.supabase = { createClient: () => window.__adminTestSupabase };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/admin.html");

    await expect(page.locator("#adminApp")).toBeVisible();
    await page.locator('#mobileBottomNav [data-section="viewings"]').click();
    await expect(page.locator("#viewingsTable")).toContainText("Test rental");
    await expect(page.locator("#viewingsTable")).toContainText("A Tenant");
    await expect(page.locator("#viewingsTable")).toContainText("I would like to view this apartment.");
    await page.evaluate(() => {
        window.__adminTestSupabase.testRows.viewings.push({
            id: "viewing-2", property_id: "property-1", tenant_id: "tenant-1", owner_id: "owner-1",
            status: "requested", message: "Second new request", created_at: "2026-11-03T13:00:00Z"
        });
    });
    await page.locator("#refreshAdminData").click();
    await expect(page.locator("#viewingsTable")).toContainText("Second new request");

    await page.locator('#mobileBottomNav [data-section="conversations"]').click();
    await page.locator("#conversationsList [data-conversation-id]").click();
    await expect(page.locator("#conversationMessages")).toContainText("Is the apartment still available?");
    await expect(page.locator("#conversationMessages")).toContainText("we can arrange a viewing");
    expect(await page.locator(".admin-conversation-layout").evaluate(element =>
        getComputedStyle(element).gridTemplateColumns
    )).not.toContain("  ");

    await page.locator("#mobileMenuBtn").click();
    await page.locator('.admin-nav [data-section="applications"]').click();
    await expect(page.locator("#applicationsTable")).toContainText("Please review my application.");
    await page.locator("#mobileMenuBtn").click();
    await page.locator('.admin-nav [data-section="notifications"]').click();
    await expect(page.locator("#notificationsTable")).toContainText("Viewing accepted");
    await expect(page.locator("#notificationsTable")).toContainText("A Tenant");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("tenant dashboard reads saved properties from the shared saved Property Page ", async ({ page }) => {
    await page.addInitScript(() => {
        const user = {
            id: "tenant-test",
            name: "Test Tenant",
            email: "tenant@example.com",
            accountType: "tenant",
            savedProperties: [1]
        };
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(user));
        localStorage.removeItem("savedProperties");
    });

    await page.goto("/tenant-dashboard.html");
    await expect(page.locator(".navbar .logo img")).toHaveAttribute("src", "IMAGES/leaseaccom-logo-full.png");
    await expect(page.locator(".navbar .logo img")).toBeVisible();
    await expect(page.locator("#savedCount")).toHaveText("1");
    await expect.poll(() => page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem("leaseaccomCurrentUser"));
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
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
    await page.route("http://127.0.0.1:8000/applications", async route => {
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "tenant-mobile-test",
            name: "Mobile Tenant",
            accountType: "tenant"
        }));
    });
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ["/tenant-dashboard.html"]) {
        await page.goto(route);
        const bell = page.getByRole("button", { name: "Open notifications" });
        const panel = page.locator(".leaseaccom-notification-panel");
        const dropdown = panel.locator(".leaseaccom-notification-panel__dropdown");
        await expect(bell).toBeVisible();
        await expect(dropdown).toBeHidden();
        await bell.click();

        await expect(panel).toHaveClass(/is-open/);
        await expect(dropdown).toBeVisible();
        await expect.poll(() => panel.locator(".leaseaccom-notification-panel__dropdown").evaluate((element) =>
            getComputedStyle(element).position
        )).toBe("fixed");
        await expect.poll(() => panel.evaluate((element) =>
            getComputedStyle(element).position
        )).toBe("fixed");
        await expect.poll(() => page.evaluate(() =>
            document.documentElement.scrollWidth <= window.innerWidth
        )).toBe(true);
        const closeTenantNotifications = panel.locator("[data-notifications-close]");
        await expect(closeTenantNotifications).toBeVisible();
        await closeTenantNotifications.click();
        await expect(panel).not.toHaveClass(/is-open/);
        await expect(dropdown).toBeHidden();
        await expect(dropdown).toHaveAttribute("aria-hidden", "true");
        await expect(bell).toHaveAttribute("aria-expanded", "false");
    }

    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-mobile-test",
            name: "Mobile Owner",
            accountType: "owner"
        }));
    });
    await page.setViewportSize({ width: 864, height: 900 });
    await page.goto("/owner-dashboard.html");
    const ownerTopbar = page.locator(".owner-topbar");
    await expect(ownerTopbar.locator(".owner-brand-text")).toBeVisible();
    await expect(ownerTopbar.locator("#ownerMenuToggle")).toBeVisible();
    await expect(ownerTopbar.locator(".owner-topbar-actions")).toBeHidden();
    await expect(ownerTopbar.locator(".owner-topbar-title--desktop")).toBeHidden();
    await expect(ownerTopbar.locator('a[href="owner-messages.html"]')).toHaveCount(0);
    await expect.poll(() => ownerTopbar.locator(".owner-brand-text img").evaluate((image) =>
        image.currentSrc.endsWith("/IMAGES/leaseaccom-logo-icon.png")
    )).toBe(true);
    const ownerLogoBounds = await ownerTopbar.locator(".owner-brand-text img").boundingBox();
    const ownerMenuBounds = await ownerTopbar.locator("#ownerMenuToggle").boundingBox();
    expect(ownerLogoBounds).not.toBeNull();
    expect(ownerMenuBounds).not.toBeNull();
    expect(ownerLogoBounds.width).toBeLessThanOrEqual(52);
    expect(ownerLogoBounds.x).toBeLessThan(ownerMenuBounds.x);
    expect(ownerMenuBounds.x).toBeGreaterThan(864 / 2);
    const ownerBottomNav = page.locator(".la-owner-bottom-nav");
    await expect(ownerBottomNav.locator("a")).toHaveCount(4);
    await expect(ownerBottomNav).not.toContainText("Plans");
    await expect(ownerBottomNav).toContainText("Payments");
    await expect(ownerBottomNav).toBeVisible();
    await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth
    )).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    const ownerBell = page.locator("#ownerNotifBtn");
    await page.locator("#ownerMenuToggle").click();
    await expect(ownerBell).toBeVisible();
    await ownerBell.click();
    const ownerPanel = page.locator("#ownerNotifPanel");
    await expect(ownerPanel).toBeVisible();
    await expect(ownerBell).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => page.locator("#ownerNotifPanel").evaluate((element) =>
        getComputedStyle(element).position
    )).toBe("absolute");
    const ownerClose = page.getByRole("button", { name: "Close notifications" });
    await expect(ownerClose).toBeInViewport();
    await ownerClose.click();
    await expect(ownerPanel).toBeHidden();
    await expect(ownerBell).toHaveAttribute("aria-expanded", "false");
    await ownerBell.click();
    await expect(ownerPanel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ownerPanel).toBeHidden();
});

test("landlord inbox and open chat stay usable on mobile screens", async ({ page }) => {
    const conversation = {
        id: "owner-mobile-message-test",
        propertyId: "owner-mobile-property",
        propertyTitle: "Bright two-bedroom apartment",
        tenantId: "tenant-mobile-message-test",
        tenantName: "Test Tenant",
        messages: [{
            sender: "tenant",
            text: "Could I arrange a viewing?",
            createdAt: new Date().toISOString()
        }]
    };
    await page.addInitScript((item) => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-mobile-message-test",
            name: "Test Owner",
            accountType: "owner"
        }));
        localStorage.setItem("leaseaccomMessages", JSON.stringify([item]));
    }, conversation);

    await page.goto("/owner-messages.html");
    const conversationRow = page.locator("#ownerConversationList .conversation-item");
    await expect(conversationRow).toHaveCount(1);
    await conversationRow.click();
    await expect(page.locator("#ownerChatContent")).toBeVisible();
    await expect(page.locator("#ownerChatPropertyCard")).toBeVisible();
    await expect(page.locator("#ownerChatMessages")).toContainText("Could I arrange a viewing?");

    const messageSearch = page.locator("#conversationSearch");
    for (const width of [320, 375, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 860 });
        await expect.poll(() => page.evaluate(() =>
            document.documentElement.scrollWidth <= window.innerWidth
        )).toBe(true);
        if (width <= 760) {
            await expect(messageSearch).toBeVisible();
            await expect.poll(() => messageSearch.evaluate(input =>
                input.getBoundingClientRect().height
            )).toBeGreaterThan(30);
        }
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await messageSearch.fill("viewing");
    await expect(messageSearch).toHaveValue("viewing");
    await page.locator("#chatBackBtn").click();
    await expect(page.locator(".om-inbox")).toBeVisible();
    await expect(page.locator(".om-chat")).toBeHidden();
});

test("tenant can send a message from a cloud-backed conversation", async ({ page }) => {
    await page.addInitScript((item) => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "tenant-send-test",
            name: "Test Tenant",
            accountType: "tenant"
        }));
        localStorage.setItem("leaseaccomMessages", "[]");
        localStorage.setItem("activeConversationId", "conversation-send-test");
    }, {});

    await page.goto("/messages.html");
    await page.evaluate(() => {
        window.LeaseAccomCloud = {
            hasSb: () => true,
            uid: async () => "tenant-send-test",
            getConversationById: async id => ({
                ok: id === "conversation-send-test",
                data: {
                    id: "conversation-send-test",
                    property_id: "property-send-test",
                    property_title: "Message test property",
                    owner_id: "owner-send-test",
                    tenant_id: "tenant-send-test",
                    owner_name: "Test Owner"
                }
            }),
            sendMessage: async (id, body) => ({
                ok: id === "conversation-send-test",
                data: { id: "message-send-test", body, created_at: new Date().toISOString() }
            }),
            notify: async () => ({ ok: true })
        };
    });

    await page.locator("#messageInput").fill("Hello, is this property still available?");
    await page.locator("#messageForm").evaluate(form => form.requestSubmit());

    await expect.poll(() => page.evaluate(() => {
        const messages = JSON.parse(localStorage.getItem("leaseaccomMessages") || "[]");
        return messages[0]?.messages?.some(message => message.text === "Hello, is this property still available?");
    })).toBe(true);
    await expect(page.locator("#messageInput")).toHaveValue("");
});

test("chat API uses the cloud conversation id and hydrates participant metadata", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "tenant-chat-api-test",
            name: "Test Tenant",
            accountType: "tenant"
        }));
        localStorage.setItem("leaseaccomMessages", JSON.stringify([{
            id: "property-chat-api-property",
            propertyId: "chat-api-property",
            ownerId: "owner-chat-api-test",
            messages: [{ id: "cached-message", text: "Keep me" }]
        }]));
        localStorage.setItem("activeConversationId", "property-chat-api-property");
    });

    await page.goto("/messages.html");
    const result = await page.evaluate(async () => {
        const row = {
            id: "cloud-chat-api-id",
            property_id: "chat-api-property",
            property_title: "Cloud chat property",
            property_image: "cloud-property.jpg",
            owner_id: "owner-chat-api-test",
            owner_name: "Test Owner",
            tenant_id: "tenant-chat-api-test",
            tenant_name: "Test Tenant",
            updated_at: "2026-11-19T12:00:00.000Z"
        };
        window.LeaseAccomCloud = {
            hasSb: () => true,
            getOrCreateConversation: async (propertyId, ownerId, tenantId) => ({
                ok: propertyId === row.property_id &&
                    ownerId === row.owner_id &&
                    tenantId === row.tenant_id,
                data: row
            }),
            listConversations: async () => ({ ok: true, data: [row] }),
            getConversationById: async id => ({
                ok: id === row.id,
                data: row
            })
        };
        const created = await window.LeaseAccomChatApi.createConversation({
            propertyId: row.property_id,
            propertyTitle: row.property_title,
            propertyImage: row.property_image,
            ownerId: row.owner_id,
            ownerName: row.owner_name,
            tenantId: row.tenant_id,
            tenantName: row.tenant_name
        });
        const listed = await window.LeaseAccomChatApi.listConversations();
        const hydrated = await window.LeaseAccomChatApi.getConversationById(row.id);
        return {
            created,
            listed,
            hydrated,
            activeId: localStorage.getItem("activeConversationId"),
            cached: JSON.parse(localStorage.getItem("leaseaccomMessages") || "[]")
        };
    });

    expect(result.created.id).toBe("cloud-chat-api-id");
    expect(result.created.participants).toEqual({
        tenantId: "tenant-chat-api-test",
        ownerId: "owner-chat-api-test"
    });
    expect(result.listed[0].propertyTitle).toBe("Cloud chat property");
    expect(result.hydrated.id).toBe("cloud-chat-api-id");
    expect(result.activeId).toBe("cloud-chat-api-id");
    expect(result.cached).toHaveLength(1);
    expect(result.cached[0].messages[0].text).toBe("Keep me");
});

test("property Contact Owner opens the canonical cloud conversation", async ({ page }) => {
    const listing = {
        id: "contact-owner-property",
        owner_id: "contact-owner-user",
        owner_name: "Test Owner",
        verification_status: "approved",
        title: "Contact owner test property",
        city: "Lagos",
        type: "Apartment",
        price: 2500000,
        period: "year",
        location: "Lekki, Lagos",
        image: "https://example.com/contact-owner.jpg",
        bedrooms: 2,
        bathrooms: 2
    };
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({
            from: () => ({
                select() { return this; },
                or() { return this; },
                eq() { return this; },
                order() { return Promise.resolve({ data: [${JSON.stringify(listing)}], error: null }); },
                then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
            }),
            auth: { getSession: async () => ({ data: { session: null }, error: null }) }
        }) };`
    }));
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "contact-owner-tenant",
            name: "Test Tenant",
            accountType: "tenant"
        }));
    });

    await page.goto(`/property-details.html?id=${listing.id}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
        window.LeaseAccomCloud = {
            hasSb: () => true,
            getOrCreateConversation: async (propertyId, ownerId, tenantId) => ({
                ok: propertyId === "contact-owner-property" &&
                    ownerId === "contact-owner-user" &&
                    tenantId === "contact-owner-tenant",
                data: {
                    id: "canonical-contact-conversation",
                    property_id: propertyId,
                    owner_id: ownerId,
                    tenant_id: tenantId
                }
            })
        };
    });
    await page.locator("#contactLandlordBtn").click();
    await expect(page).toHaveURL(/messages\.html$/);
    const cached = await page.evaluate(() => ({
        activeId: localStorage.getItem("activeConversationId"),
        conversations: JSON.parse(localStorage.getItem("leaseaccomMessages") || "[]")
    }));
    expect(cached.activeId).toBe("canonical-contact-conversation");
    expect(cached.conversations[0]).toMatchObject({
        id: "canonical-contact-conversation",
        propertyId: listing.id,
        ownerId: "contact-owner-user",
        tenantId: "contact-owner-tenant",
        propertyTitle: "Contact owner test property"
    });
});

test("tenant message inbox and chat match the responsive branded layout", async ({ page }) => {
    const conversation = {
        id: "tenant-inbox-layout-test",
        propertyId: "tenant-property-layout-test",
        propertyTitle: "Modern 2 Bedroom Apartment",
        propertyLocation: "Lekki, Lagos",
        propertyPrice: 1200000,
        period: "year",
        propertyImage: "https://example.com/apartment.jpg",
        ownerId: "owner-layout-test",
        ownerName: "LeaseAccom Support",
        messages: [
            { sender: "tenant", text: "Is this apartment still available?", createdAt: new Date().toISOString() },
            { sender: "owner", text: "Yes, would you like to schedule a viewing?", createdAt: new Date().toISOString() }
        ]
    };
    await page.addInitScript((item) => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "tenant-layout-test",
            name: "Test Tenant",
            accountType: "tenant"
        }));
        localStorage.setItem("leaseaccomMessages", JSON.stringify([item]));
    }, conversation);

    await page.goto("/messages.html");
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator(".messages-logo img")).toHaveAttribute("src", "IMAGES/leaseaccom-logo-full.png");
    await expect(page.locator(".messages-logo img")).toBeVisible();
    await expect(page.locator(".conversation-search .search-icon")).toHaveCount(1);
    await expect(page.locator("#conversationList .conversation-item")).toContainText("LeaseAccom Support");
    await expect(page.locator(".message-filter")).toHaveCount(4);
    await page.locator("#conversationList .conversation-item").click();
    await expect(page.locator("#chatPersonName")).toHaveText("LeaseAccom Support");
    await expect(page.locator(".tenant-property-card")).toContainText("Book viewing");

    for (const width of [320, 375, 768, 1280]) {
        await page.setViewportSize({ width, height: 860 });
        await expect.poll(() => page.evaluate(() =>
            document.documentElement.scrollWidth <= window.innerWidth
        )).toBe(true);
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(() => page.locator(".messages-logo img").evaluate((image) =>
        image.currentSrc.endsWith("/IMAGES/leaseaccom-logo-icon.png")
    )).toBe(true);
    await expect(page.locator("#chatVideoBtn")).toHaveCount(0);
    await expect(page.locator("#chatBackBtn svg")).toBeVisible();
    await expect(page.locator("#chatCallBtn")).toBeVisible();
    await page.locator("#chatBackBtn").click();
    await expect(page.locator(".messages-sidebar")).toBeVisible();
    await expect(page.locator(".chat-area")).toBeHidden();
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
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

test("mobile notification sheet keeps content above its dim backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "tenant-notification-layout",
            name: "Test Tenant",
            accountType: "tenant"
        }));
        localStorage.setItem("leaseaccomNotifications", JSON.stringify([{
            id: "notification-layout-test",
            title: "Test notification",
            message: "The notification content remains readable.",
            type: "info",
            read: false
        }]));
    });
    await page.goto("/tenant-dashboard.html");
    await page.getByRole("button", { name: "Open notifications" }).click();

    const dropdown = page.locator(".leaseaccom-notification-panel__dropdown");
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator(".leaseaccom-notification__body strong")).toHaveText("Test notification");
    await expect(dropdown.locator(".leaseaccom-notification__body strong")).toHaveCSS("color", "rgb(23, 33, 27)");
    await expect.poll(() => dropdown.evaluate(element =>
        (function () {
            const card = element.querySelector(".leaseaccom-notification");
            const rect = card.getBoundingClientRect();
            return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
                ?.closest(".leaseaccom-notification-panel__dropdown") === element;
        })()
    )).toBe(true);

    await page.locator(".leaseaccom-notification-panel").click({ position: { x: 2, y: 2 } });
    await expect(page.locator(".leaseaccom-notification-panel")).not.toHaveClass(/is-open/);
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
    await page.locator("#loginPassword").fill("do-not-Property Page -this-password");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page).toHaveURL(/tenant-dashboard\.html$/);

    const cachedUser = await page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomCurrentUser")));
    expect(cachedUser.id).toBe("auth-tenant-1");
    expect(cachedUser.password).toBeUndefined();
    expect(await page.evaluate(() => localStorage.getItem("leaseaccom_session_token"))).toBe("signed-test-access-token");
    expect(await page.evaluate(() => localStorage.getItem("leaseaccomUsers"))).toBeNull();
});

test("property search filters the public catalog", async ({ page }) => {
    await page.goto("/properties.html");
    const search = page.locator("#marketSearch");

    await search.fill("Lekki");
    await page.locator("#marketSearchBtn").click();

    await expect(page.locator("#marketplaceProperties .property-card").first()).toBeVisible();
    await expect(page.locator("#marketplaceProperties .property-card").first()).toContainText(/Lekki/i);
});

test("property cards share the listing link and image through the native share sheet", async ({ page }) => {
    await page.goto("/properties.html");
    await page.evaluate(() => {
        Object.defineProperty(navigator, "share", {
            configurable: true,
            value: async data => {
                window.__sharedProperty = {
                    title: data.title,
                    text: data.text,
                    url: data.url,
                    files: data.files?.map(file => file.name) || []
                };
            }
        });
        Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    });
    const shareButton = page.locator('.property-card [data-share-property]').first();
    await expect(shareButton).toBeVisible();
    await shareButton.evaluate(button => {
        button.dataset.shareImage = "IMAGES/leaseaccom-logo-icon.png";
    });
    const propertyId = await shareButton.getAttribute("data-share-property-id");
    const title = await shareButton.getAttribute("data-share-title");
    await shareButton.click();

    await expect.poll(() => page.evaluate(() => window.__sharedProperty?.url))
        .toContain(`property-details.html?id=${propertyId}`);
    expect(await page.evaluate(() => window.__sharedProperty.title)).toBe(title);
    expect(await page.evaluate(() => window.__sharedProperty.files)).toHaveLength(1);
    expect(await page.evaluate(() => window.__sharedProperty.text)).toContain("Photo:");
});

test("property cards offer WhatsApp, email, and copy-link sharing without native sharing", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    });

    await page.goto("/properties.html");
    const card = page.locator(".property-card").first();
    await card.locator("[data-share-property]").click();

    await expect(card.locator(".property-share-menu")).toBeVisible();
    await expect(card.locator(".share-property-whatsapp")).toHaveAttribute("href", /wa\.me\/\?text=/);
    await expect(card.locator(".share-property-email")).toHaveAttribute("href", /^mailto:/);
    await expect(card.locator(".copy-property-link-btn")).toBeVisible();
    const propertyId = await card.locator("[data-share-property]").getAttribute("data-share-property-id");
    expect(decodeURIComponent(await card.locator(".share-property-whatsapp").getAttribute("href")))
        .toContain(`property-details.html?id=${propertyId}`);
});

test("category property cards include the same sharing options", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    });

    await page.goto("/shortlets.html");
    const shareButton = page.locator("#catalogGrid .share-property-btn").first();
    await expect(shareButton).toBeVisible();
    await shareButton.click();
    await expect(page.locator("#catalogGrid .property-share-menu").first()).toBeVisible();
});

test("assistant guide opens, searches properties, and supports voice without tuning sliders", async ({ page }) => {
    await page.addInitScript(() => {
        window.SpeechRecognition = class {
            start() {
                this.onresult?.({ results: [[{ transcript: "How do I request a viewing?" }]] });
            }
        };
        window.speechSynthesis = { cancel() {}, speak() {} };
        window.SpeechSynthesisUtterance = function (text) {
            this.text = text;
        };
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "manifest.json");
    await expect.poll(async () => page.evaluate(async () =>
        (await navigator.serviceWorker.getRegistrations()).some((registration) =>
            registration.active?.scriptURL.endsWith("/sw.js")
        )
    )).toBe(true);
    const launcher = page.getByRole("button", { name: "Open LeaseAccom AI assistant" });
    await expect(launcher).toBeVisible();
    await expect(page.locator('script[src$="JS/floating-help.js"]')).toHaveCount(1);
    await launcher.click();
    await expect(page.locator("#assistantPanel")).toHaveClass(/is-open/);
    await expect(page.locator("#laVoiceBtn")).toBeVisible();
    await expect(page.locator("#laSpeakerBtn")).toBeVisible();
    await expect(page.locator("#assistantPanel input[type=range]")).toHaveCount(0);

    const answerStartedAt = Date.now();
    await page.locator("#laVoiceBtn").click();
    await expect(page.locator(".la-liquid-loader")).toBeVisible();
    await expect(page.locator(".assistant-message-ai").last()).toContainText("Request a viewing", { timeout: 5000 });
    expect(Date.now() - answerStartedAt).toBeGreaterThanOrEqual(2900);

    await page.locator("#laSpeakerBtn").click();
    await expect(page.locator("#laSpeakerBtn")).toHaveAttribute("title", "Voice replies off");

    await page.locator("#assistantInput").fill("Show me apartments in Lekki");
    const searchStartedAt = Date.now();
    await page.locator("#assistantForm").evaluate((form) => form.requestSubmit());
    await expect(page.locator(".la-liquid-loader")).toContainText("Searching for apartments in Lekki");
    await expect(page.locator(".assistant-result strong").first()).toContainText("Apartment", { timeout: 5000 });
    expect(Date.now() - searchStartedAt).toBeGreaterThanOrEqual(2900);
});

test("PWA install manifest exposes correctly sized icons and install action", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const manifest = await page.evaluate(async () => {
        const response = await fetch("manifest.json");
        return response.json();
    });
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map(icon => icon.sizes).sort()).toEqual(["192x192", "512x512"]);

    const iconSizes = await page.evaluate(async icons => Promise.all(icons.map(icon => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(`${image.naturalWidth}x${image.naturalHeight}`);
        image.onerror = reject;
        image.src = icon.src;
    }))), manifest.icons);
    expect(iconSizes.sort()).toEqual(["192x192", "512x512"]);

    const iconCornersAreGreen = await page.evaluate(async icons => Promise.all(icons.map(icon => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            const corners = [
                [0, 0],
                [canvas.width - 1, 0],
                [0, canvas.height - 1],
                [canvas.width - 1, canvas.height - 1]
            ];
            resolve(corners.every(([x, y]) => {
                const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
                return green > red && green > blue;
            }));
        };
        image.onerror = reject;
        image.src = icon.src;
    }))), manifest.icons);
    expect(iconCornersAreGreen).toEqual([true, true]);

    const installButton = page.locator("#installAppBtn");
    await expect(installButton).toBeHidden();
    await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        event.prompt = async () => {};
        event.userChoice = Promise.resolve({ outcome: "accepted" });
        window.dispatchEvent(event);
    });
    await expect(installButton).toBeVisible();
    await installButton.click();
    await expect(installButton).toBeHidden();
});

test("iPhone visitors can find the Add to Home Screen instructions", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "userAgent", {
            configurable: true,
            value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
        });
    });
    let instructions = "";
    page.on("dialog", async dialog => {
        instructions = dialog.message();
        await dialog.accept();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const installButton = page.locator("#installAppBtn");
    await expect(installButton).toBeVisible();
    await expect(installButton).toHaveText("Add to Home Screen");
    await installButton.click();
    expect(instructions).toContain("tap Share");
    expect(instructions).toContain("Add to Home Screen");
});

test("approved and active Supabase listings render in catalog and homepage", async ({ page }) => {
    const propertyId = "4f814eed-4f2e-4bb0-b41c-647223d495bd";
    const listing = {
        id: propertyId,
        owner_id: "owner-user-id",
        owner_name: "Test Owner",
        verification_status: "approved",
        listing_status: "pending",
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
        videos: ["https://example.com/listing-tour.mp4"],
        bedrooms: 2,
        bathrooms: 2,
        description: "Approved live test listing for the LeaseAccom marketplace."
    };
    const pendingListing = Object.assign({}, listing, {
        id: "pending-listing",
        title: "Pending Supabase Apartment",
        verification_status: "pending",
        listing_status: "pending"
    });
    const activeListing = Object.assign({}, listing, {
        id: "active-listing",
        title: "Active Status Apartment",
        verification_status: "pending",
        listing_status: "active"
    });
    const rejectedListing = Object.assign({}, listing, {
        id: "rejected-listing",
        title: "Rejected Supabase Apartment",
        verification_status: "rejected",
        listing_status: "rejected"
    });
    const rows = [listing, activeListing, pendingListing, rejectedListing];
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route => route.fulfill({
        contentType: "application/javascript",
        body: `window.supabase = { createClient: () => ({
            from: () => ({
                select() { return this; },
                or(filter) { window.__publicPropertyFilter = filter; return this; },
                eq() { return this; },
                order() { return Promise.resolve({ data: ${JSON.stringify(rows)}, error: null }); },
                then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
            }),
            auth: { getSession: async () => ({ data: { session: null }, error: null }) }
        }) };`
    }));

    await page.goto("/properties.html");
    const card = page.locator("#marketplaceProperties .property-card").filter({
        hasText: "Live Supabase Apartment"
    });
    await expect(card).toContainText("Live Supabase Apartment");
    await expect(page.locator("#marketplaceProperties")).toContainText("Active Status Apartment");
    await expect(page.locator("#marketplaceProperties")).not.toContainText("Pending Supabase Apartment");
    await expect(page.locator("#marketplaceProperties")).not.toContainText("Rejected Supabase Apartment");
    expect(await page.evaluate(() => window.__publicPropertyFilter)).toContain("listing_status.in.(approved,live,active)");
    expect(await page.evaluate(() => window.LeaseAccomData.mapPropertyRow(window.properties[0]).videos))
        .toEqual(["https://example.com/listing-tour.mp4"]);
    await page.goto("/");
    await expect(page.locator("#featuredProperties")).toContainText("Live Supabase Apartment");
    await expect(page.locator("#featuredProperties")).toContainText("Active Status Apartment");
    await expect(page.locator("#featuredProperties")).not.toContainText("Pending Supabase Apartment");
    await expect(page.locator("#featuredProperties")).not.toContainText("Rejected Supabase Apartment");
    await expect.poll(() => page.locator('[data-stat="properties"]').evaluate(element => Number(element.textContent)))
        .toBe(2);
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
                or() { return this; },
                eq() { return this; },
                then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
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
    const minMoveInDate = await page.locator("#moveInDate").getAttribute("min");
    await page.locator("#moveInDate").fill(minMoveInDate);
    await page.locator("#applicationMessage").fill("I would like to rent this apartment.");
    await page.getByRole("button", { name: "Submit Application" }).click();

    await expect(page.locator("#applicationModal")).not.toHaveClass(/active/);
    expect(submittedPayload).toMatchObject({
        property_id: propertyId,
        applicant_name: "Modal Tenant",
        applicant_phone: "08000000000",
        move_in_date: minMoveInDate
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-viewing-test",
            name: "Test Owner",
            accountType: "owner"
        }));
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/owner-dashboard.html");
    const ownerLogo = page.locator(".owner-brand-text img");
    await expect(ownerLogo).toBeVisible();
    expect(await ownerLogo.evaluate(image => getComputedStyle(image).borderRadius)).toBe("50%");

    const acceptButton = page.locator('[data-viewing-status="accepted"]');
    await acceptButton.click();

    await expect(page.locator("#ownerViewingRequests .status-badge")).toHaveText(/Accepted/i);
    expect(await page.locator("#ownerViewingRequests .viewing-card").evaluate(card =>
        getComputedStyle(card).borderRadius
    )).toBe("16px");
    expect(patchPayload).toEqual({ status: "accepted" });

    await page.evaluate(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "tenant-viewing-test",
            name: "Test Tenant",
            accountType: "tenant"
        }));
    });
    await page.goto("/viewing-requests.html");
    await expect(page.locator("#viewingRequests")).toContainText("Accepted");
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
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
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
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
    await expect(page.locator("#ownerPricingPlans .owner-subscription-card")).toHaveCount(3);
    await expect(page.locator("#ownerPricingPlans")).toContainText("₦20,000");

    await page.locator('#ownerPlan [data-select-plan="enterprise"]').click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomPlanIntent") || "null")?.planId))
        .toBe("enterprise");
    await page.getByRole("dialog", { name: "Review your plan" })
        .getByRole("button", { name: "Back to plans" }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".owner-brand-text img")).toHaveAttribute("src", "IMAGES/leaseaccom-logo-full.png");
    await expect(page.locator(".owner-brand-text img")).toBeVisible();
    await expect(page.locator(".owner-topbar-actions")).toBeHidden();
    await expect(page.locator(".la-owner-bottom-nav a")).toHaveCount(4);
    await expect(page.locator(".la-owner-bottom-nav")).not.toContainText("Plans");
    await page.locator("#ownerMenuToggle").click();
    await expect(page.locator("#ownerNotifBtn")).toBeVisible();
    await expect.poll(() => page.locator(".owner-brand-text img").evaluate((image) =>
        image.currentSrc.endsWith("/IMAGES/leaseaccom-logo-icon.png")
    )).toBe(true);
    await expect.poll(() => page.locator(".owner-subscription-grid").evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    )).toBe(1);
    await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth
    )).toBe(true);
});

test("owner plans logo aligns to the top-left on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/owner-plans.html");

    const logo = page.locator(".op-top .brand img");
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((image) =>
        image.currentSrc.endsWith("/IMAGES/leaseaccom-logo-icon.png")
    )).toBe(true);
    await expect.poll(() => logo.evaluate((image) =>
        image.getBoundingClientRect().left
    )).toBeLessThan(30);
});

test("homepage shows its spinner followed by skeleton loading", async ({ page }) => {
    await page.addInitScript(() => {
        window.landingLoaderSnapshots = [];
        const observePhases = () => {
            const root = document.documentElement;
            const record = () => {
                const spinner = document.getElementById("landingSpinnerStage");
                const skeleton = document.getElementById("landingSkeletonStage");
                window.landingLoaderSnapshots.push({
                    phase: root.getAttribute("data-landing-loader-phase"),
                    spinnerDisplay: spinner ? getComputedStyle(spinner).display : null,
                    skeletonDisplay: skeleton ? getComputedStyle(skeleton).display : null,
                    visibleCards: skeleton ? Array.from(skeleton.querySelectorAll(".landing-skeleton-card"))
                        .filter(card => getComputedStyle(card).display !== "none").length : 0
                });
            };
            new MutationObserver(record).observe(root, { attributes: true, attributeFilter: ["data-landing-loader-phase"] });
        };
        if (document.documentElement) observePhases();
        else document.addEventListener("DOMContentLoaded", observePhases, { once: true });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const brandLoader = page.locator("#landingSpinnerStage");
    const skeleton = page.locator("#landingSkeletonStage");
    await expect(brandLoader.locator("img")).toHaveAttribute("src", "IMAGES/leaseaccom-logo-full.png");
    await expect.poll(() => page.evaluate(() =>
        window.landingLoaderSnapshots.some(snapshot =>
            snapshot.phase === "skeleton" &&
            snapshot.spinnerDisplay === "none" &&
            snapshot.skeletonDisplay !== "none" &&
            snapshot.visibleCards > 0
        )
    )).toBe(true);
    await expect.poll(() => page.locator("html").getAttribute("data-landing-loader-phase"), { timeout: 10000 }).toBe("ready");
    await expect(brandLoader).toBeHidden();
    await expect(skeleton).toBeHidden();
    await expect(page.locator(".landing-skeleton-card")).toHaveCount(3);
    await expect(page.locator("#assistantPanel input[type=range]")).toHaveCount(0);
});

test("owner plan selection opens an intent-only checkout preview", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-payment-test",
            name: "Test Owner",
            email: "owner@example.com",
            accountType: "owner"
        }));
    });
    const paystackRequests = [];
    page.on("request", request => {
        if (request.url().includes("js.paystack.co")) paystackRequests.push(request.url());
    });
    await page.goto("/owner-plans.html");

    await page.locator('[data-billing="annual"]').click();
    await page.locator('[data-select-plan="business"]').click();

    expect(paystackRequests).toHaveLength(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomCurrentUser")).plan || null)).toBeNull();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomPlanIntent") || "null")))
        .toMatchObject({ planId: "business", billing: "annual", amount: 108000 });
    const checkout = page.getByRole("dialog", { name: "Review your plan" });
    await expect(checkout).toBeVisible();
    await expect(checkout).toContainText("Business");
    await expect(checkout).toContainText("Annual billing");
    await expect(checkout).toContainText("₦108,000");
    await expect(checkout).toContainText("No payment will be taken");
    await expect(checkout.getByRole("button", { name: "Payment setup coming soon" })).toBeDisabled();
    await checkout.getByRole("button", { name: "Back to plans" }).click();
    await expect(checkout).toBeHidden();
});
