import { defineBackground } from "wxt/utils/define-background";
import { startOfficialBackground } from "../src/application/official/background.js";
export default defineBackground({ type: "module", main: startOfficialBackground });
