import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
test("manual-only completion works with an empty registry, retains safety during work, and reloads readable history", async ({
  page,
}) => {
  const data = seed();
  data.items = [];
  data.jobs = [
    {
      ...data.jobs[0],
      name: "Oman osan huolto",
      requirements: [],
      recurrence: 0,
    },
  ];
  await page.addInitScript((store) => {
    localStorage.setItem("hp-welcome", "1");
    if (!localStorage.getItem("huoltopilotti-demo-v1"))
      localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(store));
  }, data);
  await page.goto("?demo=1#jobs");
  await page.getByRole("button", { name: /Oman osan huolto/ }).click();
  await expect(
    page.getByText(/Tarkistuslista ei ole lupa aloittaa/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kirjaa valmistuminen" }).click();
  await page
    .getByLabel("Tehdyt työt")
    .fill("Tiiviste vaihdettu ja toiminta tarkistettu");
  await page.getByLabel("Käytetty aika (min)").fill("29");
  await page
    .getByRole("button", { name: "Lisää varaosa (valinnainen)" })
    .click();
  let dialog = page.getByRole("dialog").last();
  await dialog.getByLabel("Nimi", { exact: true }).fill("Asentajan tiiviste");
  await dialog.getByLabel("Käytetty määrä", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "Lisää", exact: true }).click();
  await page
    .getByRole("button", { name: "Lisää työkalu (valinnainen)" })
    .click();
  dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("spinbutton")).toHaveCount(0);
  await dialog.getByLabel("Nimi", { exact: true }).fill("Oma työkalu");
  await dialog.getByRole("button", { name: "Lisää", exact: true }).click();
  await page.getByLabel("Lisähuomiot").fill("Ei vuotoja");
  await page
    .getByRole("button", { name: "Kirjaa valmiiksi", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
  );
  expect(saved.items).toEqual([]);
  expect(saved.jobs[0].freeUsage).toHaveLength(2);
  await page.reload();
  await page
    .getByRole("combobox", { name: "Tila", exact: true })
    .selectOption("completed");
  await page.getByRole("button", { name: /Oman osan huolto/ }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "Tiiviste vaihdettu ja toiminta tarkistettu",
  );
  await expect(dialog).toContainText("Asentajan tiiviste: 2 kpl");
  await expect(dialog).toContainText("Oma työkalu");
  await expect(dialog).toContainText("29 min");
  await expect(dialog).toContainText("Ei vuotoja");
  await expect(dialog).not.toContainText("Tarkistuslista ei ole lupa aloittaa");
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
