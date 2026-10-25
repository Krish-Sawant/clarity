import { expect, test, type Page } from "@playwright/test";
import baselineBank from "../src/data/baseline_questions.json";
import checkpointBank from "../src/data/checkpoint_questions.json";

function usd(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content, "The document must fit the viewport without horizontal scrolling").toBeLessThanOrEqual(dimensions.width);
}

async function answerBank(page: Page, stage: "baseline" | "checkpoint", allCorrect: boolean) {
  const questions = stage === "baseline" ? baselineBank.questions : checkpointBank.questions;
  for (const [index, question] of questions.entries()) {
    await expect(page.getByRole("heading", { name: question.prompt, exact: true })).toBeVisible();
    const option = allCorrect || index < 4
      ? question.options.find((item) => item.id === question.correct_option_id)!
      : question.options.find((item) => item.id !== question.correct_option_id)!;
    await page.getByRole("radio", { name: option.text, exact: true }).check();
    await page.getByRole("button", { name: index === questions.length - 1 ? "See my results" : "Continue", exact: true }).click();
  }
}

test("complete the synthetic knowledge, learning, reassessment, simulation and consent journey", async ({ page }) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  await expectNoOverflow(page);
  await page.goto("/discover");

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose an answer");
  await page.getByRole("button", { name: "Skip this question", exact: true }).click();
  await expect(page.getByRole("heading", { name: baselineBank.questions[1].prompt, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await answerBank(page, "baseline", false);
  await expect(page.getByRole("heading", { name: "A signal, not a label.", exact: true })).toBeFocused();
  await expect(page.locator(".score-value")).toHaveAttribute("aria-label", "4 correct out of 8");
  await expect(page.locator(".score-value")).toContainText("8 answered · 0 skipped");

  await page.getByLabel("How often do you look at your spending?").selectOption("Weekly");
  await page.getByLabel("Do you have a plan for an unexpected expense?").selectOption("Working on it");
  await page.getByRole("button", { name: "Save optional check-in", exact: true }).click();
  await expect(page.getByText("Your optional check-in is complete.", { exact: false })).toBeVisible();
  await expect(page.locator(".score-value")).toHaveAttribute("aria-label", "4 correct out of 8");
  await page.getByRole("link", { name: "Build my learning path", exact: false }).click();

  await page.locator(".lesson-menu").getByRole("button", { name: /Find your monthly surplus/ }).click();
  const exercise = page.locator(".exercise-panel");
  const exerciseOutput = await exercise.locator(".exercise-output").innerText();
  await exercise.getByRole("slider").focus();
  await page.keyboard.press("End");
  await expect(exercise.locator(".exercise-output")).not.toHaveText(exerciseOutput);
  await page.getByRole("button", { name: "Mark lesson complete", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose the answer that matches the concept");
  await page.getByRole("radio", { name: "Cut dining out from $300 to $100", exact: true }).check();
  await page.getByRole("button", { name: "Check reflection", exact: true }).click();
  await expect(page.getByText("✓ That’s the idea.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark lesson complete", exact: true }).click();
  await expect(page.getByRole("button", { name: "✓ Lesson complete", exact: true })).toBeDisabled();
  await expect(page.locator(".learning-progress")).toContainText("1 / 4");

  await page.getByRole("button", { name: "Explain another way", exact: true }).click();
  await expect(page.locator(".tutor-response")).toContainText("Opening the explanation");
  await expect(page.locator(".tutor-response")).toContainText("Prewritten explanation");
  await page.getByText("Preview an unavailable tutor", { exact: true }).click();
  await page.getByRole("button", { name: "Preview tutor error", exact: true }).click();
  await expect(page.locator(".tutor-response")).toContainText("No live Gemini request was made");
  await page.getByRole("button", { name: "Retry explanation", exact: true }).click();
  await expect(page.locator(".tutor-response")).toContainText("Prewritten explanation");
  await expectNoOverflow(page);

  await page.getByRole("link", { name: "Check what stayed with you", exact: false }).click();
  expect(checkpointBank.questions[0].prompt).not.toBe(baselineBank.questions[0].prompt);
  await answerBank(page, "checkpoint", true);
  await expect(page.locator(".score-value")).toHaveAttribute("aria-label", "8 correct out of 8");
  await expect(page.locator(".score-comparison")).toContainText("+4");
  await expect(page.locator(".comparison-caveat")).toContainText("8 / 8 concepts answered in both checks: 4 → 8 correct");
  await page.getByRole("link", { name: "Try it in Future Lab", exact: false }).click();

  await page.getByRole("spinbutton", { name: "Monthly take-home income", exact: true }).fill("3600");
  await page.getByRole("spinbutton", { name: "Monthly rent", exact: true }).fill("1300");
  await page.getByRole("spinbutton", { name: "Monthly transportation", exact: true }).fill("300");
  await page.getByRole("spinbutton", { name: "Other monthly spending", exact: true }).fill("1250");
  await page.getByRole("spinbutton", { name: "Starting cash", exact: true }).fill("1500");
  await page.getByRole("button", { name: "6 mo", exact: true }).click();
  const currentPath = page.getByRole("button", { name: /Current rhythm/ });
  await expect(currentPath).toContainText(usd(6000));
  await page.getByRole("slider", { name: "Adjust monthly rent", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("spinbutton", { name: "Monthly rent", exact: true })).toHaveValue("1350");
  await expect(currentPath).toContainText(usd(5700));
  await page.getByRole("button", { name: /An unexpected repair/ }).click();
  await expect(currentPath).toContainText(usd(4200));
  await page.getByRole("button", { name: /Spend with intention/ }).click();
  await expect(page.getByRole("button", { name: /Spend with intention/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".path-chart")).toContainText("Spend with intention ends at $5,400");
  await page.getByText("Compare the exact balances", { exact: false }).click();
  await expect(page.getByRole("row", { name: /Current rhythm/ })).toContainText(usd(4200));
  await expect(page.getByRole("row", { name: /Spend with intention/ })).toContainText(usd(5400));
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "Propose a savings goal", exact: false }).click();

  const goal = page.locator(".proposal-card").filter({ hasText: "Practice saving $900 a month" });
  await expect(goal).toBeVisible();
  await expect(goal.getByRole("button", { name: "Approve proposal", exact: false })).toBeDisabled();
  await goal.getByRole("button", { name: "Deny proposal", exact: false }).click();
  await expect(page.locator(".action-history")).toContainText("Denied · recorded");
  await page.getByLabel("Proposal title", { exact: true }).fill("Review a budget");
  await page.getByRole("button", { name: "Review proposal", exact: false }).click();
  const reminder = page.locator(".proposal-card").filter({ has: page.getByRole("heading", { name: "Review a budget", exact: true }) });
  const approve = reminder.getByRole("button", { name: "Approve proposal", exact: false });
  await expect(approve).toBeDisabled();
  await reminder.getByRole("checkbox").check();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.locator(".action-history")).toContainText("Approved · recorded");
  await expect(page.getByText("Proposal approved. No money was moved and no notification was scheduled.", { exact: true })).toBeVisible();
  await page.getByText("Integration status and upcoming tools", { exact: false }).click();
  await page.getByRole("button", { name: "Check backend connection", exact: false }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("A verified backend connection has not been configured");
  await expect(page.getByRole("button", { name: "Retry connection check", exact: false })).toBeVisible();
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("resume explicit skipped and answered questions after refresh without grading habits", async ({ page }) => {
  await page.goto("/discover");
  const first = baselineBank.questions[0];
  await page.getByRole("radio", { name: first.options.find((option) => option.id === first.correct_option_id)!.text, exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Skip this question", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: baselineBank.questions[2].prompt, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Question 1, answered", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Question 2, skipped", exact: true })).toBeVisible();
  for (let index = 2; index < baselineBank.questions.length; index += 1) await page.getByRole("button", { name: "Skip this question", exact: true }).click();
  await expect(page.locator(".score-value")).toHaveAttribute("aria-label", "1 correct out of 8");
  await expect(page.locator(".score-value")).toContainText("1 answered · 7 skipped");
  await page.getByRole("button", { name: "Skip habits", exact: true }).click();
  await expect(page.locator(".score-value")).toHaveAttribute("aria-label", "1 correct out of 8");
  await page.reload();
  await expect(page.locator(".score-value")).toHaveAttribute("aria-label", "1 correct out of 8");
  await expect(page.getByText("Your optional check-in is complete.", { exact: false })).toBeVisible();
});

test("reassessment explains the missing baseline and example journey stays labeled", async ({ page }) => {
  await page.goto("/discover?tab=reassess");
  await expect(page.getByRole("heading", { name: "A comparison needs two signals.", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Start Discover", exact: false }).click();
  await expect(page.getByRole("heading", { name: baselineBank.questions[0].prompt, exact: true })).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example journey", exact: false }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await page.goto("/discover");
  await expect(page.locator(".score-value")).toHaveAttribute("aria-label", "4 correct out of 8");
  await expect(page.getByText(/example journey/i).first()).toBeVisible();
});

test("navigation, keyboard focus and design preferences work at the current viewport", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".clarity-app")).toHaveAttribute("data-hydrated", "true");
  await page.screenshot({ path: testInfo.outputPath("overview.png"), fullPage: true, caret: "initial" });
  if (testInfo.project.name === "mobile") {
    const openNavigation = page.getByRole("button", { name: "Open navigation", exact: true });
    await openNavigation.click();
    await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Future Lab", exact: true }).click();
    await expect(page).toHaveURL(/\/future-lab$/);
    await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toHaveAttribute("aria-expanded", "false");
  } else {
    await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Our approach", exact: true }).click();
    await expect(page).toHaveURL(/\/approach$/);
  }
  await expectNoOverflow(page);

  const settings = page.getByRole("button", { name: "Design settings", exact: true });
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "Make it your own.", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "Tidal", exact: true }).check();
  const radius = dialog.getByRole("slider", { name: "Corner radius", exact: true });
  await radius.focus();
  await page.keyboard.press("Home");
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowRight");
  await expect(radius).toHaveValue("4");
  await dialog.getByRole("combobox", { name: "Elevation", exact: true }).selectOption("soft");
  await expect(page.locator(".clarity-app")).toHaveClass(/palette-tidal/);
  await expect(page.locator(".clarity-app")).toHaveCSS("--radius", "4px");
  await dialog.getByRole("button", { name: "Close design settings", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(settings).toBeFocused();
  await expectNoOverflow(page);

  await page.reload();
  await expect(page.locator(".clarity-app")).toHaveClass(/palette-tidal/);
  await expect(page.locator(".clarity-app")).toHaveCSS("--radius", "4px");
  await settings.click();
  await expect(dialog.getByRole("radio", { name: "Tidal", exact: true })).toBeChecked();
  await expect(dialog.getByRole("combobox", { name: "Elevation", exact: true })).toHaveValue("soft");
  await dialog.getByRole("button", { name: "Close design settings", exact: true }).click();
});

test("recover corrupt stored values, retain valid calculations and require fresh consent after reload", async ({ page }) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/discover");
  await page.getByRole("radio", { name: "$750", exact: true }).check();
  await page.evaluate(() => {
    const key = "clarity-editorial:demo:v1";
    const corrupted = JSON.parse(window.sessionStorage.getItem(key)!);
    corrupted.horizon = "12";
    corrupted.simulation.income = 12345;
    window.sessionStorage.setItem(key, JSON.stringify(corrupted));
  });

  // A direct server-rendered Lab load must hydrate cleanly and reject the invalid enum type.
  await page.goto("/future-lab");
  const income = page.getByRole("spinbutton", { name: "Monthly take-home income", exact: true });
  const rent = page.getByRole("spinbutton", { name: "Monthly rent", exact: true });
  const currentPath = page.getByRole("button", { name: /Current rhythm/ });
  await expect(income).toHaveValue("3600");
  await expect(page.getByRole("button", { name: "12 mo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(currentPath).toContainText(usd(10500));
  await rent.fill("-1");
  await expect(rent).toHaveValue("-1");
  await expect(rent).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("projection keeps the last valid value");
  await expect(currentPath).toContainText(usd(10500));
  await rent.fill("");
  await expect(rent).toHaveValue("");
  await expect(currentPath).toContainText(usd(10500));
  await rent.fill("1300");
  await expect(rent).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  await page.goto("/approach");
  await page.getByRole("button", { name: "Design settings", exact: true }).click();
  const design = page.getByRole("dialog", { name: "Make it your own.", exact: true });
  await design.getByRole("radio", { name: "Coral", exact: true }).check();
  await design.getByRole("button", { name: "Close design settings", exact: true }).click();
  await page.getByLabel("Proposal title", { exact: true }).fill("Review a synthetic spending plan");
  await page.getByRole("button", { name: "Review proposal", exact: false }).click();
  const pending = page.locator(".proposal-card").filter({ has: page.getByRole("heading", { name: "Review a synthetic spending plan", exact: true }) });
  await pending.getByRole("checkbox").check();
  await expect(pending.getByRole("button", { name: "Approve proposal", exact: false })).toBeEnabled();
  await page.reload();
  await expect(pending).toBeVisible();
  await expect(pending.getByRole("checkbox")).not.toBeChecked();
  await expect(pending.getByRole("button", { name: "Approve proposal", exact: false })).toBeDisabled();
  await pending.getByRole("checkbox").check();
  await pending.getByRole("button", { name: "Approve proposal", exact: false }).click();
  await page.reload();
  await expect(page.locator(".action-history")).toContainText("Review a synthetic spending plan");
  await expect(page.locator(".action-history")).toContainText("Approved · recorded");

  await page.getByRole("button", { name: "Reset my data", exact: false }).click();
  await page.getByRole("button", { name: "Keep my data", exact: true }).click();
  await expect(page.locator(".action-history")).toContainText("Review a synthetic spending plan");
  await page.getByRole("button", { name: "Reset my data", exact: false }).click();
  await page.getByRole("button", { name: "Yes, clear my data", exact: true }).click();
  await expect(page.locator(".action-history")).toHaveCount(0);
  await expect(page.getByText("Progress cleared. Your design preferences are preserved.", { exact: true })).toBeVisible();
  await expect(page.locator(".clarity-app")).toHaveClass(/palette-coral/);
  await page.reload();
  await expect(page.locator(".action-history")).toHaveCount(0);
  await expect(page.locator(".clarity-app")).toHaveClass(/palette-coral/);
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
