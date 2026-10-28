export const GOVERNANCE_SETTINGS_KEY = "settings"

export const GOVERNANCE_MODES = ["off", "intercept"] as const
export type GovernanceMode = (typeof GOVERNANCE_MODES)[number]

export const APPROVAL_APP_IDS = ["none", "aipa-approvals", "aipa-fluxnova"] as const
export type ApprovalAppId = (typeof APPROVAL_APP_IDS)[number]

export type GovernanceSettings = {
  mode: GovernanceMode
  approvalAppId: ApprovalAppId
}

export const GOVERNANCE_DEFAULT_SETTINGS: GovernanceSettings = {
  mode: "intercept",
  approvalAppId: "aipa-approvals",
}

export function isGovernanceMode(value: unknown): value is GovernanceMode {
  return GOVERNANCE_MODES.includes(value as GovernanceMode)
}

export function isApprovalAppId(value: unknown): value is ApprovalAppId {
  return APPROVAL_APP_IDS.includes(value as ApprovalAppId)
}

export function resolveSettings(stored: GovernanceSettings | null): GovernanceSettings {
  const mode =
    stored && isGovernanceMode(stored.mode) ? stored.mode : GOVERNANCE_DEFAULT_SETTINGS.mode
  const approvalAppId =
    stored && isApprovalAppId(stored.approvalAppId)
      ? stored.approvalAppId
      : GOVERNANCE_DEFAULT_SETTINGS.approvalAppId
  return { mode, approvalAppId }
}
