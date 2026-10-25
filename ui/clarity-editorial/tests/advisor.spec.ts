import { expect, test } from "@playwright/test";

test("possible moments cycle in both directions with five cards and preserved selection", async ({ page }) => {
  await page.goto("/advisor");
  const cards = page.locator(".advisor-signal");
  await expect(cards).toHaveCount(5);
  await page.getByRole("button", { name: "Review a possible job change", exact: true }).click();
  await page.getByRole("button", { name: "Previous possible moments", exact: true }).click();
  await expect(cards).toHaveCount(5);
  await expect(cards.first()).toContainText("A possible income increase");
  await expect(page.locator(".advisor-confirmation")).toContainText("A possible job change");
  await page.getByRole("button", { name: "Next possible moments", exact: true }).click();
  await expect(cards.first()).toContainText("A possible job change");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next possible moments", exact: true }).click();
  await expect(cards).toHaveCount(5);
  await page.getByRole("button", { name: "Review possible moving costs", exact: true }).click();
  await expect(page.locator(".advisor-confirmation")).toContainText("City Movers");
  await expect(page.locator(".advisor-plan-metrics")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm this moment", exact: true }).click();
  await expect(page.locator(".advisor-plan-metrics")).toContainText("$610");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("confirm a synthetic advisor signal, inspect merged engine math and explicitly deny its proposal", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/advisor");
  await expect(page.locator(".clarity-app")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".advisor-signal")).toHaveCount(5);
  const propose = page.getByRole("button", { name: "Review this savings proposal", exact: false });
  await expect(propose).toBeDisabled();
  await expect(page.locator(".advisor-plan-metrics")).toHaveCount(0);

  await page.getByRole("button", { name: "Review a possible move", exact: true }).click();
  await expect(page.locator(".advisor-confirmation")).toContainText("River Property Management");
  await page.getByRole("button", { name: "This does not fit", exact: false }).click();
  await expect(page.getByRole("button", { name: "Review a possible move", exact: true })).toBeDisabled();
  await expect(propose).toBeDisabled();

  await page.getByRole("button", { name: "Review a possible job change", exact: true }).click();
  await expect(page.locator(".advisor-confirmation")).toContainText("Northstar Labs");
  await expect(page.locator(".advisor-plan-metrics")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm this moment", exact: true }).click();
  const metrics = page.locator(".advisor-plan-metrics");
  await expect(metrics).toContainText("$1,220");
  await expect(metrics).toContainText("$5,640");
  await expect(metrics).toContainText("$610");
  await expect(metrics).toContainText("$204");
  await expect(propose).toBeEnabled();

  const expenses = page.getByRole("spinbutton", { name: "Monthly expenses", exact: true });
  await expenses.fill("3600");
  await expect(metrics).toContainText("$600");
  await expect(metrics).toContainText("$5,700");
  await expenses.fill("-1");
  await expect(expenses).toHaveValue("-1");
  await expect(expenses).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Enter a number");
  await expect(metrics).toHaveCount(0);
  await expect(propose).toBeDisabled();
  await expenses.fill("3600");
  await expect(propose).toBeEnabled();
  await expect(metrics).toContainText("$600");

  await page.getByText("Inspect the activity", { exact: false }).click();
  await expect(page.getByRole("row", { name: /2026-10-15 Northstar Labs/ })).toBeVisible();
  const viewportFit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(viewportFit).toBe(true);
  await propose.click();
  await expect(page).toHaveURL(/\/approach#proposals$/);
  const pending = page.locator(".proposal-card").filter({ has: page.getByRole("heading", { name: "Review saving $600 a month", exact: true }) });
  await expect(pending).toContainText("$3,600 monthly expenses");
  await expect(pending).toContainText("Approval records your choice only");
  await expect(pending.getByRole("button", { name: "Approve proposal", exact: false })).toBeDisabled();
  await pending.getByRole("button", { name: "Deny proposal", exact: false }).click();
  await expect(page.locator(".action-history")).toContainText("Review saving $600 a month");
  await expect(page.locator(".action-history")).toContainText("Denied · recorded");
  await page.reload();
  await expect(page.locator(".action-history")).toContainText("Review saving $600 a month");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("a deficit blocks a savings proposal and a changed signal requires fresh confirmation", async ({ page }) => {
  await page.goto("/advisor");
  await page.getByRole("button", { name: "Review a possible job change", exact: true }).click();
  await page.getByRole("button", { name: "Confirm this moment", exact: true }).click();
  const propose = page.getByRole("button", { name: "Review this savings proposal", exact: false });
  await page.getByRole("spinbutton", { name: "Monthly take-home income", exact: true }).fill("3000");
  await expect(page.locator(".advisor-plan-metrics")).toContainText("$0");
  await expect(page.getByText("There is no positive savings amount to propose.", { exact: false })).toBeVisible();
  await expect(propose).toBeDisabled();

  await page.getByRole("button", { name: "Review a growing cash cushion", exact: true }).click();
  await expect(page.locator(".advisor-plan-metrics")).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: "Monthly take-home income", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Confirm this moment", exact: true }).click();
  await expect(propose).toBeDisabled();
  await page.getByRole("spinbutton", { name: "Monthly take-home income", exact: true }).fill("4800");
  await expect(page.locator(".advisor-plan-metrics")).toContainText("$610");
  const annualRate = page.getByRole("spinbutton", { name: "Illustrative annual rate (%)", exact: true });
  await annualRate.fill("101");
  await expect(annualRate).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".advisor-plan-metrics")).toHaveCount(0);
  await expect(propose).toBeDisabled();
  await annualRate.fill("4");
  await expect(page.locator(".advisor-plan-metrics")).toContainText("$204");
  await expect(propose).toBeEnabled();
});
