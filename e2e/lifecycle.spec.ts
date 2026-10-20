import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
import { completeJob } from "../src/domain";
test("equipment and line lifecycle preserve history, restore without moving devices, and safely delete empty records", async ({
  page,
  isMobile,
}) => {
  let s = seed();
  s.productionLines = [];
  s.faults = [];
  s.jobs = [{ ...s.jobs[0], assetId: s.assets[0].id, recurrence: 0 }];
  s = completeJob(s, s.jobs[0].id, {}, "Vanha huoltohistoria", 20);
  await page.addInitScript((store) => {
    localStorage.setItem("hp-welcome", "1");
    if (!localStorage.getItem("huoltopilotti-demo-v1"))
      localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(store));
  }, s);
  await page.goto("?demo=1#assets");
  const createLine = async (name: string) => {
    await page
      .getByRole("button", { name: "Lisää tuotantolinja", exact: true })
      .click();
    await page.getByLabel("Nimi", { exact: true }).fill(name);
    await page.getByLabel("Tuotantolinjan tunniste (valinnainen)").fill(name);
    await page.getByRole("button", { name: "Tallenna", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  };
  await createLine("Testilinja");
  const card = page
    .locator(".equipment-card")
    .filter({
      has: page.getByRole("heading", { name: "CNC Haas VF-2", exact: true }),
    });
  await card
    .getByRole("button", { name: "Arkistoi laite", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(s.assets[0].serial);
  await dialog
    .getByRole("button", { name: "Arkistoi laite", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toHaveCount(0);
  await page
    .getByRole("button", { name: "Arkistoidut laitteet", exact: true })
    .click();
  await expect(card).toContainText("Arkistoitu");
  await expect(
    card.getByRole("button", { name: "Uusi huoltotyö", exact: true }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Poista pysyvästi", exact: true }),
  ).toHaveCount(0);
  await card
    .getByRole("button", { name: "Huoltohistoria", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Kuljettimen laakerihuolto/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Vanha huoltohistoria");
  await expect(page.getByRole("dialog")).toContainText("Arkistoitu");
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await card
    .getByRole("button", { name: "Palauta aktiiviseksi", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox")
    .selectOption({ label: "Testilinja · Testilinja" });
  await dialog
    .getByRole("button", { name: "Palauta aktiiviseksi", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Kaikki laitteet", exact: true })
    .click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Testilinja", exact: true }).click();
  await page
    .getByRole("button", { name: "Arkistoi tuotantolinja", exact: true })
    .click();
  const confirmation = page.getByRole("alert");
  await expect(confirmation).toContainText("Testilinja");
  await expect(confirmation).toContainText("0 Avoimet huoltotyöt");
  await confirmation
    .getByRole("button", { name: "Arkistoi ja säilytä laitteet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "CNC Haas VF-2", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Arkistoidut tuotantolinjat", exact: true })
    .click();
  await page.getByRole("button", { name: /Testilinja.*Testilinja/ }).click();
  await page
    .getByRole("button", { name: "Palauta tuotantolinja", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("ei siirretä takaisin");
  await dialog
    .getByRole("button", { name: "Palauta tuotantolinja", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Kaikki laitteet", exact: true })
    .click();
  await expect(card).toContainText("Ei tuotantolinjaa");
  await createLine("Virhelinja");
  await page
    .getByRole("button", { name: "Tuotantolinjat", exact: true })
    .click();
  await page.getByRole("button", { name: /Virhelinja.*Virhelinja/ }).click();
  await page
    .getByRole("button", { name: "Poista pysyvästi", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Virhelinja");
  await dialog
    .getByRole("button", { name: "Poista pysyvästi", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Kaikki laitteet", exact: true })
    .click();
  await page.getByRole("button", { name: "Lisää laite", exact: true }).click();
  await page.getByLabel("Nimi", { exact: true }).fill("Virhelaite");
  await page.getByLabel("Sarjanumero", { exact: true }).fill("ERR-1");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const empty = page
    .locator(".equipment-card")
    .filter({
      has: page.getByRole("heading", { name: "Virhelaite", exact: true }),
    });
  await empty
    .getByRole("button", { name: "Poista pysyvästi", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Virhelaite · ERR-1");
  await dialog
    .getByRole("button", { name: "Poista pysyvästi", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(empty).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(saved.jobs).toEqual(s.jobs);
  expect(saved.items).toEqual(s.items);
  expect(saved.assets).toHaveLength(s.assets.length);
  expect(saved.archivedProductionLines).toEqual([]);
  await page.reload();
  await expect(card).toBeVisible();
  expect(
    isMobile
      ? await page.locator("main").evaluate((el) => el.clientWidth < 500)
      : true,
  ).toBeTruthy();
});
