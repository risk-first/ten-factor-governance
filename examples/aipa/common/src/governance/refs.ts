export const CONSOLE_APP_ID = 'aipa-governance-console';
export const DIRECT_APP_ID = 'aipa-direct-governance';
export const JEV_APP_ID = 'aipa-jev-governance';
export const APPROVALS_APP_ID = 'aipa-approvals';
export const FLUXNOVA_APP_ID = 'aipa-fluxnova';

export const APPROVALS_JWKS = 'http://localhost:4110/.well-known/jwks.json';
export const FLUXNOVA_JWKS = 'http://localhost:4112/.well-known/jwks.json';

export const TRUSTED_APPROVER_APP_IDS = new Set([APPROVALS_APP_ID, FLUXNOVA_APP_ID]);
export const TRUSTED_APPROVER_JWKS = new Set([APPROVALS_JWKS, FLUXNOVA_JWKS]);

export const POLICY_REF = 'apa-policy';
export const CONTROLS_REF = 'apa-controls';

export const CTL_005 = 'apa-ctl-005-propose-human-approval';
export const CTL_005_AR = 'apa-ctl-005-propose-human-approval.ar01';
export const CTL_005_PLAN = 'ap-apa-005-propose-human-approval';

export const CTL_006 = 'apa-ctl-006-execute-prohibit';
export const CTL_006_AR = 'apa-ctl-006-execute-prohibit.ar01';
export const CTL_006_PLAN = 'ap-apa-006-execute-prohibit';

export type EvalResult = 'Passed' | 'Needs Review' | 'Failed';
export type EnforcementDecision = 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY';

const DEFAULT_CONTROLS_CATALOG_URL =
  'https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/gemara/components/ai-portfolio-assistant/controls-catalog';
const DEFAULT_POLICY_URL =
  'https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/gemara/policy';

export function mappingReferences(): Array<{ id: string; title: string; version: string; url: string }> {
  const controlsCatalogUrl =
    (typeof process !== 'undefined' && process.env?.GEMARA_CONTROLS_CATALOG_URL?.trim()) ||
    DEFAULT_CONTROLS_CATALOG_URL;
  const policyUrl =
    (typeof process !== 'undefined' && process.env?.GEMARA_POLICY_URL?.trim()) || DEFAULT_POLICY_URL;
  return [
    {
      id: POLICY_REF,
      title: 'AI Portfolio Assistant Policy',
      version: '0.2.0',
      url: policyUrl,
    },
    {
      id: CONTROLS_REF,
      title: 'AI Portfolio Assistant Control Catalog',
      version: '0.4.0',
      url: controlsCatalogUrl,
    },
  ];
}

export function evalResultToEnforcement(result: EvalResult | undefined): EnforcementDecision {
  if (result === 'Passed') return 'ALLOW';
  if (result === 'Failed') return 'DENY';
  return 'REQUIRE_APPROVAL';
}

export function jevOutcomeToEvalResult(outcome: string): EvalResult {
  if (outcome === 'Allow') return 'Passed';
  if (outcome === 'Block') return 'Failed';
  return 'Needs Review';
}

export function planIdForControl(controlId: string): string {
  return controlId.includes('006') ? CTL_006_PLAN : CTL_005_PLAN;
}

export function isTrustedApprover(actorAppId: string | undefined, signatureJku: string | undefined): boolean {
  if (actorAppId && TRUSTED_APPROVER_APP_IDS.has(actorAppId)) return true;
  return typeof signatureJku === 'string' && TRUSTED_APPROVER_JWKS.has(signatureJku);
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
