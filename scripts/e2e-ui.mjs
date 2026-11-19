import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const out = { steps: [], errors: [] };
page.on("pageerror", (e) => out.errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") out.errors.push(m.text()); });

const step = async (name, fn) => {
  try { await fn(); out.steps.push({ name, ok: true }); }
  catch (e) { out.steps.push({ name, ok: false, error: String(e).slice(0, 240) }); throw e; }
};

try {
  await step("app loads", async () => {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByText(/Tek Kopya|Depolama/).first().waitFor({ timeout: 15000 });
  });

  await step("chats listed", async () => {
    await page.getByText(/sohbet|Sohbet|genel/i).first().waitFor({ timeout: 15000 });
  });

  await step("metrics nonzero", async () => {
    await page.waitForTimeout(3500);
    const body = await page.locator("body").innerText();
    out.metrics = body.match(/(\d[\d.,]*)\s*(KB|MB|B)/gi)?.slice(0, 6) ?? [];
    if (!(out.metrics.length > 0)) throw new Error("no metric numbers visible");
  });

  await step("open chat and view image", async () => {
    const chat = page.locator("button, a").filter({ hasText: /genel|sohbet/i }).first();
    if (await chat.count()) await chat.click();
    await page.waitForTimeout(2000);
    const img = page.locator("img").first();
    if (await img.count()) {
      await img.click({ force: true });
      await page.waitForTimeout(1500);
      out.modal = /kapat|görsel|resim/i.test(await page.locator("body").innerText());
    }
  });
} catch {}

console.log(JSON.stringify(out, null, 2));
await browser.close();
