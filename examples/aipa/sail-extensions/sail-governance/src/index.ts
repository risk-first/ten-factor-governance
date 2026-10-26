import { applyExtensions, SAIL_CONFIG_UI, type SailExtension } from "@finos/sail-extension"

import {
  GOVERNANCE_SETTINGS_KEY,
  resolveSettings,
  type GovernanceSettings,
} from "./settings.js"

export const governanceExtension: SailExtension = {
  id: "sail-governance",
  title: "Sail Governance",
  getUIExtensions() {
    return [
      { type: SAIL_CONFIG_UI, url: new URL("./ui.tsx", import.meta.url).href },
      { type: SAIL_CONFIG_UI, url: new URL("./evaluation-log.tsx", import.meta.url).href },
      { type: SAIL_CONFIG_UI, url: new URL("./enforcement-log.tsx", import.meta.url).href },
    ]
  },
  wrapServer(instance, ctx) {
    let intercept: typeof instance.receive | undefined
    return applyExtensions(instance, {
      receive: async (message, from) => {
        const settings = resolveSettings(await ctx.storage.get<GovernanceSettings>(GOVERNANCE_SETTINGS_KEY))
        if (settings.mode === "off") {
          return instance.receive(message, from)
        }
        intercept ??= (await import("./wrap-server.js")).createGovernanceReceive(instance)
        return intercept(message, from)
      },
    })
  },
}

export default governanceExtension
