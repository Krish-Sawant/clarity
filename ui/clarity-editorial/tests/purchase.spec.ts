import { expect, test, type Page } from "@playwright/test";

async function confirmSample(page: Page, timing: "planned" | "posted") {
  const confirm = page.getByRole("button", { name: "Confirm sample assumptions", exact: false });
  await expect(confirm).toBeDisabled();
  await page.getByRole("checkbox", { name: "I confirm this sample purchase is funded from the goal savings account.", exact: true }).check();
  await expect(confirm).toBeDisabled();
  await page.getByRole("checkbox", { name: timing === "posted" ? "I confirm this balance already includes the purchase." : "I confirm this balance is before the purchase.", exact: true }).check();
  await confirm.click();
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("confirm a planned purchase, compare exact goal paths and hide invalid draft results", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/purchase-impact");
  await expect(page.locator(".clarity-app")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".purchase-signal")).toContainText("Demo Electronics");
  await expect(page.locator(".purchase-signal")).toContainText("2026-10-24");
  await expect(page.locator(".purchase-metrics")).toHaveCount(0);
  await confirmSample(page, "planned");
  const metrics = page.locator(".purchase-metrics");
  await expect(metrics).toContainText("Month 5");
  await expect(metrics).toContainText("Month 7");
  await expect(metrics).toContainText("2 months");
  await expect(metrics).toContainText("$1,800");
  await page.getByText("See exact monthly savings", { exact: false }).click();
  await expect(page.getByRole("row", { name: /^0 / })).toContainText("$3,000");
  await expect(page.getByRole("row", { name: /^0 / })).toContainText("$1,800");
  await expect(page.getByRole("row", { name: /^5 / })).toContainText("$6,000");
  await expect(page.getByRole("row", { name: /^5 / })).toContainText("$4,800");

  const price = page.getByRole("spinbutton", { name: "Purchase price (USD)", exact: true });
  await price.fill("600");
  await expect(metrics).toContainText("Month 6");
  await expect(metrics).toContainText("1 month");
  await expect(metrics).toContainText("$2,400");
  await price.fill("0.001");
  await expect(price).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("at most two decimal places");
  await expect(metrics).toHaveCount(0);
  await expect(page.locator(".purchase-chart")).toHaveCount(0);
  await price.fill("600");
  await expect(metrics).toContainText("1 month");
  await page.getByText("Assumptions and calculation source", { exact: false }).click();
  await expect(page.locator(".purchase-source")).toContainText("Fixed month-end savings contributions, zero interest");
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("posted purchases require timing confirmation and preserve null milestones and cash gaps", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/purchase-impact");
  await page.getByRole("button", { name: "Review detected sample purchase", exact: false }).click();
  await expect(page.getByRole("combobox", { name: "Balance timing", exact: true })).toHaveValue("posted");
  await expect(page.getByRole("spinbutton", { name: "Current goal savings (USD)", exact: true })).toHaveValue("1800");
  await expect(page.locator(".purchase-metrics")).toHaveCount(0);
  await confirmSample(page, "posted");
  const metrics = page.locator(".purchase-metrics");
  await expect(metrics).toContainText("Month 5");
  await expect(metrics).toContainText("Month 7");
  await expect(metrics).toContainText("$1,800");
  await page.getByText("See exact monthly savings", { exact: false }).click();
  await expect(page.getByRole("row", { name: /^0 / })).toContainText("$3,000");
  await expect(page.getByRole("row", { name: /^0 / })).toContainText("$1,800");
  await page.getByRole("spinbutton", { name: "Monthly contribution (USD)", exact: true }).fill("0");
  await expect(metrics).toContainText("Beyond projection");
  await expect(metrics).toContainText("Unavailable");
  await expect(page.locator(".purchase-result-message")).toContainText("not reached within 120 months in either scenario");
  await page.getByRole("spinbutton", { name: "Monthly contribution (USD)", exact: true }).fill("600");
  await page.getByRole("spinbutton", { name: "Projection horizon (months)", exact: true }).fill("5");
  await expect(metrics).toContainText("Month 5");
  await expect(metrics).toContainText("Beyond projection");
  await expect(metrics).toContainText("Unavailable");

  await page.getByRole("combobox", { name: "Balance timing", exact: true }).selectOption("planned");
  await expect(metrics).toHaveCount(0);
  await page.getByRole("spinbutton", { name: "Current goal savings (USD)", exact: true }).fill("500");
  await page.getByRole("spinbutton", { name: "Projection horizon (months)", exact: true }).fill("12");
  await confirmSample(page, "planned");
  await expect(page.locator(".purchase-shortfall")).toContainText("Unfunded cash gap: $700.");
  await expect(metrics).toContainText("-$700");
  await expect(page.locator(".purchase-chart")).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "Reset purchase example", exact: false }).click();
  await expect(metrics).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: "Current goal savings (USD)", exact: true })).toHaveValue("3000");
  expect(errors).toEqual([]);
});
