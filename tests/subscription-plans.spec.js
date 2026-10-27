const { test, expect } = require("@playwright/test");

test("landing plan buttons explain checkout is pending without changing the owner's plan", async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify({
            id: "owner-plans-test",
            accountType: "owner",
            plan: "free"
        }));
    });
    await page.goto("/");

    await expect(page.locator("#owner-plans .op-card")).toHaveCount(3);
    const businessButton = page.locator('#owner-plans [data-plan-checkout="business"]');
    await expect(businessButton).toBeEnabled();
    await businessButton.click();
    await expect(page.locator("#owner-plans [data-plan-message]")).toContainText("checkout is not available yet");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("leaseaccomCurrentUser")).plan)).toBe("free");
    expect(await page.evaluate(() => localStorage.getItem("leaseaccomPlanIntent"))).toBeNull();
});

test("admin plan buttons are enabled and show checkout status", async ({ page }) => {
    await page.goto("/admin/admin.html");

    const buttons = page.locator("#planAdminCards [data-plan-checkout]");
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toBeEnabled();
    await buttons.nth(0).evaluate((button) => button.click());
    await expect(page.locator("#section-payments [data-plan-message]")).toContainText("checkout is not available yet");
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
    expect(await page.evaluate(() => localStorage.getItem("leaseaccomPlanIntent"))).toBeNull();
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
    await expect(page.locator("#ownerPlan .owner-subscription-card").nth(1)).toContainText("Advanced property and enquiry analytics");
    await expect(page.locator("#ownerPlan .owner-subscription-card").nth(2)).toContainText("AI assistant");
    await expect(page.locator("#ownerFeatured .owner-featured-video")).toBeVisible();
    await expect(page.locator("#ownerPlan a[href='owner-plans.html']")).toHaveCount(0);

    await page.locator("#ownerManagePlanBtn").click();
    await expect(page).toHaveURL(/owner-dashboard\.html$/);

    await page.locator('#ownerPlan [data-billing="annual"]').click();
    await expect(page.locator('#ownerPlan [data-price-for="professional"]')).toHaveText("₦4,500");
    await expect(page.locator('#ownerPlan [data-annual-note="professional"]')).toContainText("₦54,000");
    await expect(page.locator('#ownerPlan [data-billing="annual"]')).toHaveAttribute("aria-pressed", "true");

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator('#ownerPlan [data-select-plan="business"]').click();
    await expect(page.locator("#ownerPlanSummary")).toContainText("Free");
    expect(await page.evaluate(() => localStorage.getItem("leaseaccomPlanIntent"))).toBeNull();
});
