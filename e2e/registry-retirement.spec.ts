import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
import { applyLifecycle } from "../src/lifecycle";
test("final removal requires typing an identifier and preserves original searchable history", async ({
  page,
  isMobile,
}) => {
  const base = seed();
  base.jobs = [
    { ...base.jobs[0], recurrence: 0, description: "Moottorin ylivirta" },
  ];
  let s = completeJob(base, "j1", {}, "Kaapeli korjattu", 20);
  const asset = s.assets.find((a) => a.id === s.jobs[0].assetId)!;
  s = applyLifecycle(s, { kind: "asset_archive", data: { id: asset.id } });
  await page.addInitScript((data) => {
    localStorage.setItem("hp-welcome", "1");
    if (!localStorage.getItem("huoltopilotti-demo-v1"))
      localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
  }, s);
  await page.goto("?demo=1#assets");
  await page
    .getByRole("button", { name: "Arkistoidut laitteet", exact: true })
    .click();
  const card = page
    .locator(".equipment-card")
    .filter({
      has: page.getByRole("heading", { name: asset.name, exact: true }),
    });
  await card
    .getByRole("button", {
      name: "Poista lopullisesti rekisteristä",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", {
      name: "Poista lopullisesti rekisteristä",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog.getByRole("textbox").fill("WRONG");
  await expect(
    dialog.getByRole("button", {
      name: "Poista lopullisesti rekisteristä",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog.getByRole("textbox").fill(asset.serial);
  await dialog
    .getByRole("button", {
      name: "Poista lopullisesti rekisteristä",
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toHaveCount(0);
  if (isMobile)
    await page.getByRole("button", { name: "Valikko", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Huoltotutka", exact: true })
    .click();
  await page.getByLabel("Kuvaus", { exact: true }).fill("ylivirta");
  await page
    .getByRole("button", { name: "Etsi historiasta", exact: true })
    .click();
  const result = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: s.jobs[0].name, exact: true }),
    });
  await expect(result).toContainText("Poistettu rekisteristä");
  await expect(result).toContainText(asset.name);
  await result
    .getByRole("button", { name: "Avaa alkuperäinen kirjaus", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Kaapeli korjattu");
  await expect(page.getByRole("dialog")).toContainText(
    "Poistettu rekisteristä",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!).jobs,
    ),
  ).toEqual(s.jobs);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
