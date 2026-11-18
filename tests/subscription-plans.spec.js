const { test, expect } = require("@playwright/test");

test("owner plan buttons save a checkout intent without changing the owner's plan", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-plans-test",
            accountType: "owner",
            plan: "free"
        }));
    });
    await page.goto("/owner-plans.html");

    await expect(page.locator("#plansGrid .op-card")).toHaveCount(3);
    const businessButton = page.locator('#plansGrid [data-select-plan="business"]');
    await expect(businessButton).toBeEnabled();
    page.once("dialog", dialog => dialog.accept());
    await businessButton.click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomCurrentUser")).plan)).toBe("free");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomPlanIntent") || "null")))
        .toMatchObject({ planId: "business", billing: "monthly", amount: 10000 });
});

test("admin plan cards match the three-plan contract while checkout is paused", async ({ page }) => {
    await page.goto("/admin/admin.html");

    await expect(page.locator("#assistantPanel, #assistantLauncher, #laFloatingHelp")).toHaveCount(0);
    const cards = page.locator("#planAdminCards .op-card");
    await expect(cards).toHaveCount(3);
    await expect(cards).toContainText(["Free", "Business", "Enterprise"]);
    const buttons = page.locator("#planAdminCards .cta");
    await expect(buttons).toHaveCount(3);
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toBeDisabled();
});

test("owner plans do not activate a paid plan before checkout is connected", async ({ page }) => {
    await page.addInitScript(() => {
        const user = {
            id: "owner-plans-test",
            accountType: "owner",
            plan: "free",
            subscriptionPlan: "free"
        };
        localStorage.setItem("leasehubCurrentUser", JSON.stringify(user));
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(user));
    });
    await page.goto("/owner-plans.html");

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator('[data-select-plan="business"]').click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomCurrentUser")).plan)).toBe("free");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomPlanIntent") || "null")))
        .toMatchObject({ planId: "business", billing: "monthly", amount: 10000 });
});

test("owner dashboard contains the full subscription page inline", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-dashboard-plans-test",
            name: "Test Owner",
            email: "owner@example.com",
            accountType: "owner"
        }));
    });
    await page.goto("/owner-dashboard.html");

    await expect(page.locator("#ownerPlan .owner-subscription-card")).toHaveCount(3);
    await expect(page.locator("#ownerPricingPlans")).toBeVisible();
    await expect(page.locator("#ownerPlan .owner-subscription-card").nth(0)).toContainText("Up to 5 active listings");
    await expect(page.locator("#ownerPlan .owner-subscription-card").nth(1)).toContainText("Full portfolio analytics");
    await expect(page.locator("#ownerPlan .owner-subscription-card").nth(2)).toContainText("AI assistant");
    await expect(page.locator("#ownerFeatured .owner-featured-video")).toBeVisible();
    await expect(page.locator("#ownerPlan a[href='owner-plans.html']")).toHaveCount(0);

    await page.locator("#ownerManagePlanBtn").click();
    await expect(page).toHaveURL(/owner-dashboard\.html$/);

    await page.locator('#ownerPlan [data-billing="annual"]').click();
    await expect(page.locator('#ownerPlan [data-price-for="business"]')).toHaveText("₦9,000");
    await expect(page.locator('#ownerPlan [data-annual-note="business"]')).toContainText("₦108,000");
    await expect(page.locator('#ownerPlan [data-billing="annual"]')).toHaveAttribute("aria-pressed", "true");

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator('#ownerPlan [data-select-plan="business"]').click();
    await expect(page.locator("#ownerPlanSummary")).toContainText("Free");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomPlanIntent") || "null")))
        .toMatchObject({ planId: "business", billing: "annual", amount: 108000 });
});
