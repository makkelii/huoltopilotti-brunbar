import { test, expect } from "@playwright/test";
test("dashboard, equipment, readiness and historical troubleshooting", async ({
  page,
  isMobile,
}) => {
  await page.goto("?demo=1");
  await page.getByRole("button", { name: "Aloitetaan" }).click();
  await expect(
    page.getByRole("heading", { name: /Hyvää työpäivää/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  if (isMobile)
    await page.getByRole("button", { name: "Valikko", exact: true }).click();
  await page.getByRole("button", { name: "Laitteet", exact: true }).click();
  await page.getByRole("button", { name: "Lisää laite" }).click();
  await page.getByLabel("Nimi", { exact: true }).fill("Browser test motor");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test motor" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser test motor" }),
  ).toBeVisible();
  if (isMobile)
    await page.getByRole("button", { name: "Valikko", exact: true }).click();
  await page.getByRole("button", { name: "Huoltotutka", exact: true }).click();
  await page
    .getByLabel("Kuvaus", { exact: true })
    .fill("Moottori käynnistyy mutta pysähtyy");
  await page.getByRole("button", { name: "Etsi historiasta" }).click();
  await expect(
    page.getByText("Demotapaus: ylikuormitusreleen laukeaminen"),
  ).toBeVisible();
});

test("edits equipment, creates and edits job, prepares and completes with stock usage", async ({
  page,
  isMobile,
}) => {
  await page.goto("?demo=1");
  await page.getByRole("button", { name: "Aloitetaan" }).click();
  const navigate = async (name: string) => {
    if (isMobile)
      await page.getByRole("button", { name: "Valikko", exact: true }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
  };
  await navigate("Laitteet");
  await page
    .getByRole("button", { name: "Muokkaa", exact: true })
    .first()
    .click();
  await page.getByLabel("Nimi", { exact: true }).fill("Edited CNC");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edited CNC" })).toBeVisible();
  await navigate("Huoltotyöt 4");
  await page.getByRole("button", { name: "Uusi huoltotyö" }).click();
  await page.getByLabel("Nimi", { exact: true }).fill("Test maintenance");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Test maintenance" });
  await row.getByRole("button", { name: "Muokkaa" }).click();
  await page.getByLabel("Nimi", { exact: true }).fill("Revised maintenance");
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await page.getByRole("button", { name: /Revised maintenance/ }).click();
  await expect(
    page.getByText(/Tarkistuslista ei ole lupa aloittaa/),
  ).toBeVisible();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").first().selectOption("review");
  await expect(dialog.getByRole("combobox").first()).toHaveValue("review");
  await dialog.getByRole("button", { name: "Kirjaa valmistuminen" }).click();
  await expect(dialog.getByRole("spinbutton")).toHaveCount(1);
  await page
    .getByText("Valitse varastosta tai työkalurekisteristä", { exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Lisää · Käytetyt varaosat ja tarvikkeet" })
    .click();
  await page.getByRole("searchbox").fill("SKF");
  await page.getByRole("button", { name: /SKF 6205-2RS.*Tuotenumero/ }).click();
  await dialog.getByLabel("Käytetty määrä · SKF 6205-2RS").fill("0.5");
  await dialog
    .getByRole("button", { name: "Poista valinta · SKF 6205-2RS" })
    .click();
  await dialog
    .getByRole("button", { name: "Lisää · Käytetyt varaosat ja tarvikkeet" })
    .click();
  await page.getByRole("searchbox").fill("SKF");
  await page.getByRole("button", { name: /SKF 6205-2RS.*Tuotenumero/ }).click();
  await dialog.getByLabel("Käytetty määrä · SKF 6205-2RS").fill("1");
  await dialog
    .getByRole("button", { name: "Lisää · Käytetyt työkalut" })
    .click();
  await page.getByRole("searchbox").fill("Momenttiavain");
  await page.getByRole("searchbox").press("Tab");
  const toolResult = page.getByRole("button", {
    name: /Momenttiavain.*Tuotenumero/,
  });
  await expect(toolResult).toBeVisible();
  await toolResult.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByText("Käytetty", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await dialog.getByLabel("Tehdyt työt").fill("Verified demo completion");
  await dialog
    .getByRole("button", { name: "Kirjaa valmiiksi", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await navigate("Varaosat ja työkalut");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "SKF 6205-2RS" })
      .getByRole("cell")
      .nth(2),
  ).toHaveText("0");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Momenttiavain" })
      .getByRole("cell")
      .nth(2),
  ).toHaveText("");
  const toolQuantity = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("huoltopilotti-demo-v1")!);
    return saved.items.find((item: { id: string }) => item.id === "i1")
      .quantity;
  });
  expect(toolQuantity).toBe(2);
  await page.getByLabel("Tyyppi").selectOption("tools");
  await expect(page.getByRole("columnheader", { name: "Määrä" })).toHaveCount(
    0,
  );
  await navigate("Raportit");
  await page.getByRole("button", { name: /Revised maintenance/ }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Verified demo completion", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await navigate("Laitteet");
  await page.reload();
  await page
    .locator(".asset-card")
    .filter({ hasText: "Edited CNC" })
    .getByRole("button", { name: "Huoltohistoria" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Revised maintenance/ })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Verified demo completion", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/SKF 6205-2RS/)
      .last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await navigate("Varaosat ja työkalut");
  await page
    .getByRole("row")
    .filter({ hasText: "SKF 6205-2RS" })
    .getByRole("button", { name: "Muokkaa" })
    .click();
  await page
    .getByLabel("Nimi", { exact: true })
    .fill("Renamed and archived bearing");
  await page.getByLabel("Poistettu käytöstä", { exact: true }).check();
  await page.getByRole("button", { name: "Tallenna", exact: true }).click();
  await page.reload();
  await navigate("Laitteet");
  await page
    .locator(".asset-card")
    .filter({ hasText: "Edited CNC" })
    .getByRole("button", { name: "Huoltohistoria" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Revised maintenance/ })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/SKF 6205-2RS/)
      .last(),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(/Renamed and archived bearing/),
  ).toHaveCount(0);
});

test("optional registry fields are expandable and usable on mobile", async ({
  page,
  isMobile,
}) => {
  await page.goto("?demo=1");
  await page.getByRole("button", { name: "Aloitetaan" }).click();
  if (isMobile)
    await page.getByRole("button", { name: "Valikko", exact: true }).click();
  await expect(
    page.getByText("Valinnaiset rekisterit", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Varaosat ja työkalut", exact: true })
    .click();
  await page.getByRole("button", { name: "Lisää nimike", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Määrä", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Kalibrointi voimassa")).not.toBeVisible();
  await dialog.getByLabel("Nimi", { exact: true }).fill("Calibrated tool");
  await dialog.getByLabel("Varastopaikka").fill("Cabinet");
  await dialog.getByText("Lisätiedot", { exact: true }).click();
  await dialog.getByLabel("Kalibrointi voimassa").fill("2027-01-01");
  await dialog.getByLabel("Tuotenumero", { exact: true }).fill("T-100");
  await expect(dialog.getByLabel("Kalibrointi voimassa")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await dialog.getByRole("button", { name: "Tallenna", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Calibrated tool" }),
  ).toContainText("T-100");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Calibrated tool" }),
  ).toContainText("2027-01-01");
});
