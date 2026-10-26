import { applyExtensions, SAIL_CONFIG_UI, type SailExtension } from "@finos/sail-extension"

import { createGovernanceReceive } from "./wrap-server.js"

export const governanceExtension: SailExtension = {
  id: "sail-governance",
  title: "Sail Governance",
  getUIExtensions() {
    return [{ type: SAIL_CONFIG_UI, url: new URL("./ui.tsx", import.meta.url).href }]
  },
  wrapServer(instance, ctx) {
    return applyExtensions(instance, {
      receive: createGovernanceReceive(instance, ctx.storage),
    })
  },
}

export default governanceExtension
