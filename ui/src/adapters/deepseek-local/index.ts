import type { UIAdapterModule } from "../types";
import {
  parseDeepSeekStdoutLine,
  buildDeepSeekLocalConfig,
} from "@zephyr-nexus/adapter-deepseek-local/ui";
import { DeepSeekLocalConfigFields } from "./config-fields";

export const deepSeekLocalUIAdapter: UIAdapterModule = {
  type: "deepseek_local",
  label: "DeepSeek (third-party)",
  parseStdoutLine: parseDeepSeekStdoutLine,
  ConfigFields: DeepSeekLocalConfigFields,
  buildAdapterConfig: buildDeepSeekLocalConfig,
};
