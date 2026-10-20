import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";

test("plan work from a line, confirm actual usage and navigate immutable history on desktop and phone", async ({
  page,
  isMobile,
}, testInfo) => {
  const data = seed();
  data.jobs = [];
  data.templateRequirements = [];
  data.productionLines = [
    {
      id: "line1",
      name: "Pakkaus",
      identifier: "P1",
      location: "Halli",
      description: "",
    },
    {
      id: "line2",
      name: "Täyttö",
      identifier: "T1",
      location: "",
      description: "",
    },
  ];
  data.assets[0].productionLineId = "line1";
  data.assets[1].productionLineId = "line2";
  data.assets[1].name = data.assets[0].name;
  data.assets[0].serial = "SER-A";
  data.assets[1].serial = "SER-B";
  await page.addInitScript((s) => {
    localStorage.setItem("hp-welcome", "1");
    if (!localStorage.getItem("huoltopilotti-demo-v1"))
      localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(s));
  }, data);
  await page.goto("?demo=1#assets");
  await page
    .getByRole("button", { name: "Tuotantolinjat", exact: true })
    .click();
  await page.getByRole("button", { name: /P1 Pakkaus/ }).click();
  await page
    .locator(".assets-workspace > button")
    .filter({ hasText: "Uusi huoltotyö" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("combobox", { name: "Tuotantolinjat", exact: true }),
  ).toHaveValue("line1");
  await expect(
    dialog.getByRole("combobox", { name: "Laite", exact: true }),
  ).toHaveValue("");
  await dialog
    .getByRole("combobox", { name: "Laite", exact: true })
    .selectOption("a1");
  await dialog
    .getByRole("combobox", { name: "Tuotantolinjat", exact: true })
    .selectOption("line2");
  await expect(
    dialog.getByRole("combobox", { name: "Laite", exact: true }),
  ).toHaveValue("");
  await expect(dialog.getByRole("option", { name: /SER-A/ })).toHaveCount(0);
  await dialog
    .getByRole("combobox", { name: "Tuotantolinjat", exact: true })
    .selectOption("line1");
  await dialog
    .getByRole("combobox", { name: "Laite", exact: true })
    .selectOption("a1");
  await dialog.getByLabel("Nimi", { exact: true }).fill("Tiivistehuolto");
  await dialog
    .getByLabel("Kuvaus", { exact: true })
    .fill("Tarkista tiiviste ja puhdista");
  await dialog.getByText("Lisää suunniteltu tarve tai ohje").click();
  await dialog.getByLabel("Tarpeen nimi tai ohje").fill("Oma tiiviste");
  await dialog
    .getByRole("button", { name: "Lisää nimike", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Valitse rekisteristä", exact: true })
    .selectOption("i2");
  await dialog
    .getByRole("button", { name: "Lisää nimike", exact: true })
    .click();
  await dialog
    .getByLabel("Työohjeet ja valmistelut")
    .fill("Puhdista ennen asennusta");
  await page.screenshot({
    path: testInfo.outputPath(
      `prb-plan-${isMobile ? "mobile" : "desktop"}.png`,
    ),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const planned = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(planned.items).toEqual(data.items);
  expect(planned.templateRequirements).toEqual([]);
  // Enter through equipment, using the same navigation as a normal user.
  await page
    .getByRole("group", { name: "Tuotantolinjan näkymät" })
    .getByRole("button", { name: "Avoimet huoltotyöt", exact: true })
    .click();
  await page.getByRole("button", { name: /Tiivistehuolto/ }).click();
  await expect(dialog).toContainText("Puhdista ennen asennusta");
  await dialog
    .getByRole("button", { name: "Kirjaa valmistuminen", exact: true })
    .click();
  await dialog.getByLabel("Tehdyt työt").fill("Tiiviste vaihdettu ja testattu");
  await dialog.getByLabel("Käytetty aika (min)").fill("25");
  await dialog.getByText("Suunnitellut tarvikkeet", { exact: true }).click();
  await dialog
    .getByRole("button", {
      name: "Vahvista käyttöön · Oma tiiviste",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: /Vahvista käyttöön · SKF 6205-2RS/ })
    .click();
  await dialog
    .getByRole("button", { name: "Kirjaa valmiiksi", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const completed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(
    completed.items.find((i: { id: string }) => i.id === "i2").quantity,
  ).toBe(data.items.find((i) => i.id === "i2")!.quantity - 1);
  expect(completed.items.find((i: { id: string }) => i.id === "i1")).toEqual(
    data.items.find((i) => i.id === "i1"),
  );
  await page
    .getByRole("group", { name: "Tuotantolinjan näkymät" })
    .getByRole("button", { name: "Huoltohistoria", exact: true })
    .click();
  await page.getByRole("button", { name: /Tiivistehuolto/ }).click();
  await expect(dialog).toContainText("Tiiviste vaihdettu ja testattu");
  await expect(dialog).toContainText("Oma tiiviste");
  await expect(dialog.locator(".safety-notice")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Laite: CNC Haas VF-2", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "CNC Haas VF-2", exact: true }),
  ).toHaveCount(1);
  await page
    .locator(".equipment-card")
    .getByRole("button", { name: "Pakkaus", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pakkaus", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.reload();
  const reloaded = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(reloaded.jobs).toEqual(completed.jobs);
});
