import { defineContentScript } from "wxt/utils/define-content-script";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  allFrames: false,
  registration: "manifest",
  main() {},
});
