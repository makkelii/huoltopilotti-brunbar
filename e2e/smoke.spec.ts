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
  await dialog
    .getByLabel(/SKF 6205-2RS/)
    .last()
    .fill("1");
  await dialog
    .getByLabel("Muistiinpanot / vahvistettu korjaus")
    .fill("Verified demo completion");
  await dialog.getByRole("button", { name: "Vahvista", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await navigate("Varasto ja työkalut");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "SKF 6205-2RS" })
      .getByRole("cell")
      .nth(2),
  ).toHaveText("0");
  await navigate("Raportit");
  await page.getByRole("button", { name: /Revised maintenance/ }).click();
  await expect(
    page.getByText("Verified demo completion", { exact: true }),
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
    page.getByText("Verified demo completion", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/SKF 6205-2RS/)
      .last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sulje", exact: true }).click();
  await navigate("Varasto ja työkalut");
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
