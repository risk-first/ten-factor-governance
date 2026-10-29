import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import {
  SAIL_CONFIG_UI,
  type SailExtensionConfigProps,
  type SailExtensionUI,
} from "@finos/sail-extension/ui"

import {
  APPROVAL_APP_IDS,
  GOVERNANCE_DEFAULT_SETTINGS,
  GOVERNANCE_MODES,
  GOVERNANCE_SETTINGS_KEY,
  resolveSettings,
  type ApprovalAppId,
  type GovernanceMode,
  type GovernanceSettings,
} from "./settings.js"

const MODE_LABELS: Record<GovernanceMode, string> = {
  off: "Off — forward every raise unchanged",
  intercept: "Intercept — require approval for unsigned demo.SubmitOrder",
}

const APPROVAL_APP_LABELS: Record<ApprovalAppId, string> = {
  none: "none — platform decides (any GetApproval listener)",
  "aipa-approvals": "aipa-approvals — Approvals stub inbox",
  "aipa-fluxnova": "aipa-fluxnova — Fluxnova bridge / Tasklist",
}

export function ConfigScreen({ storage }: SailExtensionConfigProps) {
  const [settings, setSettings] = useState<GovernanceSettings>(GOVERNANCE_DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void storage.get<GovernanceSettings>(GOVERNANCE_SETTINGS_KEY).then(stored => {
      setSettings(resolveSettings(stored))
      setReady(true)
    })
  }, [storage])

  async function persist(next: GovernanceSettings): Promise<void> {
    setSettings(next)
    await storage.set(GOVERNANCE_SETTINGS_KEY, next)
  }

  if (!ready) {
    return <p>Loading…</p>
  }

  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "32rem" }}
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
            checked={settings.mode === value}
            onChange={() => {
              void persist({ ...settings, mode: value })
            }}
          />
          {MODE_LABELS[value]}
        </label>
      ))}

      <p style={{ margin: "0.5rem 0 0", fontWeight: 600 }}>GetApproval app</p>
      <p style={{ margin: 0, fontSize: "0.9rem", color: "#475467" }}>
        Where <code>REQUIRE_APPROVAL</code> posts <code>GetApproval</code>.
      </p>
      {APPROVAL_APP_IDS.map((value: ApprovalAppId) => (
        <label key={value} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="radio"
            name="approval-app"
            checked={settings.approvalAppId === value}
            onChange={() => {
              void persist({ ...settings, approvalAppId: value })
            }}
          />
          {APPROVAL_APP_LABELS[value]}
        </label>
      ))}

      <p style={{ margin: "0.5rem 0 0", fontWeight: 600 }}>Approver</p>
      <p style={{ margin: 0, fontSize: "0.9rem", color: "#475467" }}>
        Name written onto <code>GetApproval</code> as the Fluxnova task assignee. Default{" "}
        <code>demo</code> matches the engine Tasklist user.
      </p>
      <input
        type="text"
        name="approver"
        value={settings.approver}
        autoComplete="off"
        spellCheck={false}
        style={{ padding: "0.4rem 0.5rem", font: "inherit" }}
        onChange={event => {
          void persist({ ...settings, approver: event.target.value })
        }}
        onBlur={() => {
          const approver = settings.approver.trim() || GOVERNANCE_DEFAULT_SETTINGS.approver
          if (approver !== settings.approver) {
            void persist({ ...settings, approver })
          }
        }}
      />
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
