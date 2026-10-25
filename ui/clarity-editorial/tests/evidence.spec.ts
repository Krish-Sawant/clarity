import { expect, test } from "@playwright/test";

test("recorded pilot shows real counts, review coverage and contextual limits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/approach#evidence");
  await expect(page.locator(".clarity-app")).toHaveAttribute("data-hydrated", "true");
  const a = page.getByRole("article", { name: "Condition A: Text-only advisor", exact: true });
  const b = page.getByRole("article", { name: "Condition B: With calculation tools", exact: true });
  await expect(a).toContainText("11 / 22");
  await expect(a).toContainText("50.0%");
  await expect(b).toContainText("21 / 22");
  await expect(b).toContainText("95.5%");
  await expect(page.getByText("Review coverage: 9 / 12 answer pairs.", { exact: false })).toBeVisible();
  await page.getByText("Inspect the actual saved answers", { exact: false }).click();
  await expect(page.locator(".evidence-example")).toContainText("694 cents");
  await expect(page.locator(".evidence-example")).toContainText("14.10 dollars");
  await page.getByText("Review coverage and supporting evidence", { exact: false }).click();
  await expect(page.locator(".evidence-review-details")).toContainText("partial-projection");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
