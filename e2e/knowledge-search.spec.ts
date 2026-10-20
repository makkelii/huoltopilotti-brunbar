import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
test("knowledge search finds maintenance and faults, combines filters and opens original readable history", async ({
  page,
}) => {
  const base = seed();
  base.jobs = [
    {
      ...base.jobs[0],
      name: "Moottorin ylivirtahuolto",
      description: "Moottori menee ylivirralle",
      recurrence: 0,
    },
  ];
  const s = completeJob(base, "j1", {}, "Laakeri ja kaapeli vaihdettu", 20);
  await page.addInitScript((data) => {
    localStorage.setItem("hp-welcome", "1");
    localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
  }, s);
  await page.goto("?demo=1#radar");
  await page.getByLabel("Kuvaus", { exact: true }).fill("moottori");
  await page
    .getByRole("button", { name: "Etsi historiasta", exact: true })
    .click();
  const result = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Moottorin ylivirtahuolto",
        exact: true,
      }),
    });
  await expect(result).toContainText("Laakeri ja kaapeli vaihdettu");
  await result
    .getByRole("button", { name: "Avaa alkuperäinen kirjaus", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("20 min");
  await expect(page.getByRole("dialog")).not.toContainText("2026-10-20T");
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await page.getByText("Rajaa historiatietoja", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Tyyppi", exact: true })
    .selectOption("maintenance");
  await page
    .getByRole("button", { name: "Etsi historiasta", exact: true })
    .click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByLabel("Kuvaus", { exact: true }).fill("zzzzzz");
  await page
    .getByRole("button", { name: "Etsi historiasta", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Ei aiempia tapauksia");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
