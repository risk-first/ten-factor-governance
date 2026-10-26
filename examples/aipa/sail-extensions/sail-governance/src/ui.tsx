import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import {
  SAIL_CONFIG_UI,
  type SailExtensionConfigProps,
  type SailExtensionUI,
} from "@finos/sail-extension/ui"

import {
  GOVERNANCE_DEFAULT_SETTINGS,
  GOVERNANCE_MODES,
  GOVERNANCE_SETTINGS_KEY,
  resolveSettings,
  type GovernanceMode,
  type GovernanceSettings,
} from "./settings.js"

const MODE_LABELS: Record<GovernanceMode, string> = {
  off: "Off — forward every raise unchanged",
  intercept: "Intercept — require approval for unsigned demo.SubmitOrder",
}

export function ConfigScreen({ storage }: SailExtensionConfigProps) {
  const [mode, setMode] = useState<GovernanceMode>(GOVERNANCE_DEFAULT_SETTINGS.mode)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void storage.get<GovernanceSettings>(GOVERNANCE_SETTINGS_KEY).then(stored => {
      setMode(resolveSettings(stored).mode)
      setReady(true)
    })
  }, [storage])

  async function persist(next: GovernanceSettings): Promise<void> {
    await storage.set(GOVERNANCE_SETTINGS_KEY, next)
  }

  if (!ready) {
    return <p>Loading…</p>
  }

  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "28rem" }}
      onSubmit={event => event.preventDefault()}
    >
      <p style={{ margin: 0 }}>
        Desktop Agent governance. <code>intercept</code> parks unsigned{" "}
        <code>demo.SubmitOrder</code> raises and sends <code>GetApproval</code>.
      </p>
      {GOVERNANCE_MODES.map((value: GovernanceMode) => (
        <label key={value} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="radio"
            name="governance-mode"
            checked={mode === value}
            onChange={() => {
              const next = { mode: value }
              setMode(value)
              void persist(next)
            }}
          />
          {MODE_LABELS[value]}
        </label>
      ))}
    </form>
  )
}

export function mount(el: HTMLElement, props: SailExtensionConfigProps): () => void {
  const root = createRoot(el)
  root.render(<ConfigScreen {...props} />)
  return () => {
    root.unmount()
  }
}

export const governanceExtensionUI: SailExtensionUI = {
  id: "sail-governance",
  title: "Sail Governance",
  type: SAIL_CONFIG_UI,
  ConfigScreen,
  mount,
}

export default governanceExtensionUI
