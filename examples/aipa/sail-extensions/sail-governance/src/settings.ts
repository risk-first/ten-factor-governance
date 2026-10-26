export const GOVERNANCE_SETTINGS_KEY = "settings"

export const GOVERNANCE_MODES = ["off", "intercept"] as const
export type GovernanceMode = (typeof GOVERNANCE_MODES)[number]

export type GovernanceSettings = { mode: GovernanceMode }

export const GOVERNANCE_DEFAULT_SETTINGS: GovernanceSettings = {
  mode: "intercept",
}

export function isGovernanceMode(value: unknown): value is GovernanceMode {
  return GOVERNANCE_MODES.includes(value as GovernanceMode)
}

export function resolveSettings(stored: GovernanceSettings | null): GovernanceSettings {
  if (stored && isGovernanceMode(stored.mode)) {
    return { mode: stored.mode }
  }
  return GOVERNANCE_DEFAULT_SETTINGS
}
