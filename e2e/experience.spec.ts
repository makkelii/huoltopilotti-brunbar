import { test, expect } from "@playwright/test";
import { seed } from "../src/seed";
import type { Store } from "../src/domain";

test("new equipment to repeated maintenance, archive, restore and final retirement preserves history", async ({
  page,
}) => {
  test.setTimeout(90000);
  const s = seed();
  s.assets = [];
  s.jobs = [];
  s.faults = [];
  s.productionLines = [];
  s.templateRequirements = [];
  await page.addInitScript((data) => {
    localStorage.setItem("hp-welcome", "1");
    if (!localStorage.getItem("huoltopilotti-demo-v1"))
      localStorage.setItem("huoltopilotti-demo-v1", JSON.stringify(data));
  }, s);
  const read = () =>
    page.evaluate<Store>(() =>
      JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!),
    );
  const navigate = async (name: string) => {
    const menu = page.getByRole("button", { name: "Valikko", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  };
  const dialog = page.getByRole("dialog");
  const save = async () => {
    await dialog.getByRole("button", { name: "Tallenna", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  };
  const fits = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  await page.goto("?demo=1#assets");
  await page
    .getByRole("button", { name: "Lisää tuotantolinja", exact: true })
    .click();
  await dialog.getByLabel("Nimi", { exact: true }).fill("Koeajolinja");
  await dialog
    .getByLabel("Tuotantolinjan tunniste (valinnainen)")
    .fill("RUN-1");
  await save();
  await page.getByRole("button", { name: "Lisää laite", exact: true }).click();
  await dialog.getByLabel("Nimi", { exact: true }).fill("Koeajomoottori");
  await dialog.getByLabel("Sarjanumero", { exact: true }).fill("MOTOR-1");
  await dialog
    .getByLabel("Tuotantolinja (valinnainen)")
    .selectOption({ label: "Koeajolinja · RUN-1" });
  await save();
  const card = page
    .locator(".equipment-card")
    .filter({
      has: page.getByRole("heading", { name: "Koeajomoottori", exact: true }),
    });
  await card
    .getByRole("button", { name: "Uusi huoltotyö", exact: true })
    .click();
  await dialog
    .getByLabel("Nimi", { exact: true })
    .fill("Moottorin ylivirtahuolto");
  await dialog
    .getByLabel("Kuvaus", { exact: true })
    .fill("Moottorin ylivirta käynnistyksessä");
  await dialog.getByText("Lisää suunniteltu tarve tai ohje").click();
  await dialog
    .getByRole("combobox", { name: "Valitse rekisteristä", exact: true })
    .selectOption("i2");
  await dialog
    .getByRole("button", { name: "Lisää nimike", exact: true })
    .click();
  await save();
  expect((await read()).items).toEqual(s.items);
  await navigate("Huoltotyöt");
  const complete = async (name: string, consume: boolean) => {
    await page
      .getByRole("combobox", { name: "Tila", exact: true })
      .selectOption("active");
    await page
      .getByRole("button", { name: new RegExp(name) })
      .first()
      .click();
    await dialog
      .getByRole("button", { name: "Kirjaa valmistuminen", exact: true })
      .click();
    await dialog
      .getByLabel("Tehdyt työt")
      .fill("Laakeri vaihdettu, kaapeli tarkistettu ja koeajo tehty");
    await dialog.getByLabel("Käytetty aika (min)").fill("25");
    if (consume) {
      await dialog
        .getByText("Suunnitellut tarvikkeet", { exact: true })
        .click();
      await dialog
        .getByRole("button", { name: /Vahvista käyttöön · SKF 6205-2RS/ })
        .click();
    }
    await fits();
    await dialog
      .getByRole("button", { name: "Kirjaa valmiiksi", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  };
  await complete("Moottorin ylivirtahuolto", true);
  const first = await read();
  expect(first.items.find((i) => i.id === "i2")!.quantity).toBe(
    s.items.find((i) => i.id === "i2")!.quantity - 1,
  );
  await page
    .getByRole("combobox", { name: "Tila", exact: true })
    .selectOption("completed");
  await page
    .getByRole("button", { name: /Moottorin ylivirtahuolto/ })
    .first()
    .click();
  await expect(dialog).toContainText("Laakeri vaihdettu");
  await expect(dialog.locator(".safety-notice")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Tee sama huolto uudelleen", exact: true })
    .click();
  await dialog
    .getByLabel("Nimi", { exact: true })
    .fill("Moottorin seurantahuolto");
  await save();
  expect((await read()).jobs[0]).toEqual(first.jobs[0]);
  expect((await read()).items).toEqual(first.items);
  await complete("Moottorin seurantahuolto", false);
  const history = (await read()).jobs;
  expect((await read()).items).toEqual(first.items);
  await navigate("Huoltotutka");
  await page.getByLabel("Kuvaus", { exact: true }).fill("ylivirta");
  await page
    .getByRole("button", { name: "Etsi historiasta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Moottorin ylivirtahuolto",
      exact: true,
    }),
  ).toBeVisible();
  await navigate("Laitteet");
  const lifecycle = async (label: string) => {
    await card.getByRole("button", { name: label, exact: true }).click();
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(dialog).toHaveCount(0);
  };
  await lifecycle("Arkistoi laite");
  await page
    .getByRole("button", { name: "Arkistoidut laitteet", exact: true })
    .click();
  await lifecycle("Palauta aktiiviseksi");
  await page
    .getByRole("button", { name: "Kaikki laitteet", exact: true })
    .click();
  await lifecycle("Arkistoi laite");
  await page
    .getByRole("button", { name: "Arkistoidut laitteet", exact: true })
    .click();
  await card
    .getByRole("button", {
      name: "Poista lopullisesti rekisteristä",
      exact: true,
    })
    .click();
  await dialog.getByRole("textbox").fill("MOTOR-1");
  await fits();
  await dialog
    .getByRole("button", {
      name: "Poista lopullisesti rekisteristä",
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toHaveCount(0);
  expect((await read()).jobs).toEqual(history);
  await navigate("Huoltotutka");
  await page.getByLabel("Kuvaus", { exact: true }).fill("ylivirta");
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
  await expect(result).toContainText("Poistettu rekisteristä");
  await result
    .getByRole("button", { name: "Avaa alkuperäinen kirjaus", exact: true })
    .click();
  await expect(dialog).toContainText("Laakeri vaihdettu");
  await expect(dialog).toContainText("Koeajomoottori");
  await fits();
  await page.reload();
  expect((await read()).jobs).toEqual(history);
});
