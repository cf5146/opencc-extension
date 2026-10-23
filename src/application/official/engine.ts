import { browser } from "wxt/browser";
import { configName, type ConversionOptions } from "./settings.js";
export async function convertTexts(texts: string[], options: ConversionOptions): Promise<string[]> {
  const response = await browser.runtime.sendMessage({ type: "official-convert", config: configName(options), texts });
  if (response?.error) throw new Error(response.error);
  if (
    !Array.isArray(response?.texts) ||
    response.texts.length !== texts.length ||
    response.texts.some((v: unknown) => typeof v !== "string")
  )
    throw new Error("轉換引擎回應無效；原文保留。");
  return response.texts;
}
interface Engine {
  convert(config: string, texts: string[]): Promise<string[]>;
}
let direct: Promise<Engine> | undefined, creating: Promise<void> | undefined;
export async function runEngine(config: string, texts: string[]): Promise<string[]> {
  if (typeof Worker !== "undefined") {
    direct ??= (async () => {
      const url = browser.runtime.getURL("/opencc/host.mjs");
      const mod = await import(/* @vite-ignore */ url);
      return mod.createWorkerEngine() as Engine;
    })();
    return (await direct).convert(config, texts);
  }
  if (!browser.offscreen) throw new Error("此瀏覽器無法建立離線轉換 Worker。");
  creating ??= (async () => {
    const contexts = await browser.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [browser.runtime.getURL("/opencc-offscreen.html")],
    });
    if (!contexts.length)
      await browser.offscreen.createDocument({
        url: "opencc-offscreen.html",
        reasons: ["WORKERS"],
        justification: "Run the bundled official OpenCC engine outside the page and service worker.",
      });
  })().finally(() => {
    creating = undefined;
  });
  await creating;
  const r = await browser.runtime.sendMessage({ target: "opencc-offscreen", config, texts });
  if (r?.error) throw new Error(r.error);
  if (!Array.isArray(r?.texts)) throw new Error("離線轉換 Worker 無回應。");
  return r.texts;
}
