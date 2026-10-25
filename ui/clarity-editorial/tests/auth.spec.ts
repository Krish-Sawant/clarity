import { expect, test } from "@playwright/test";

// Always test anonymous access, even when journey tests load a signed-in session.
test.use({ storageState: { cookies: [], origins: [] } });

test("signed-out visitors cannot open private pages", async ({ page }) => {
  for (const path of ["/", "/account", "/discover", "/advisor"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "A clearer future starts here." })).toBeVisible();
  }
});

test("account API rejects a request without a session", async ({ request }) => {
  const response = await request.get("/api/account");
  // Unconfigured environments fail closed with 503; configured ones return 401.
  expect([401, 503]).toContain(response.status());
});
