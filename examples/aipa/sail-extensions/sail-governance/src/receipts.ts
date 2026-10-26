import type { EnforcementLogData as EnforcementLog, EvaluationLogData as EvaluationLog } from "@gemara/react"

export type GovernanceDecision = "ALLOW" | "REQUIRE_APPROVAL"

const POLICY_REF = "apa-policy"
const CONTROLS_REF = "apa-controls"
const CONTROL_ID = "apa-ctl-005-propose-human-approval"
const REQUIREMENT_ID = "apa-ctl-005-propose-human-approval.ar01"
const PLAN_ID = "ap-apa-005-propose-human-approval"
const METHOD_ID = "em-apa-require-human-approval"

const MAPPING_REFERENCES = [
  {
    id: POLICY_REF,
    title: "AI Portfolio Assistant Policy",
    version: "0.2.0",
    url: "file://src/data/governance/finos/ai-portfolio-assistant/gemara/policy.yaml",
  },
  {
    id: CONTROLS_REF,
    title: "AI Portfolio Assistant Control Catalog",
    version: "0.2.0",
    url: "file://src/data/governance/finos/ai-portfolio-assistant/gemara/components/ai-portfolio-assistant/control.yaml",
  },
]

function isoNow(): string {
  return new Date().toISOString()
}

function author() {
  return {
    id: "sail-governance",
    name: "Sail Governance",
    type: "Software",
    version: "0.0.0",
  }
}

export function buildEvaluationLog(input: {
  id: string
  actorAppId: string
  intent: string
  decision: GovernanceDecision
  message: string
}): EvaluationLog {
  const start = isoNow()
  const result = input.decision === "ALLOW" ? "Passed" : "Needs Review"
  return {
    metadata: {
      id: `sail-eval-${input.id}`,
      type: "EvaluationLog",
      version: "0.1.0",
      "gemara-version": "1.2.0",
      date: start,
      description: `Inspection of ${input.intent} from ${input.actorAppId}: ${input.decision}`,
      author: author(),
      "mapping-references": MAPPING_REFERENCES,
    },
    result,
    target: {
      id: input.actorAppId,
      name: input.actorAppId,
      type: "Software",
    },
    evaluations: [
      {
        name: CONTROL_ID,
        result,
        message: input.message,
        control: { "reference-id": CONTROLS_REF, "entry-id": CONTROL_ID },
        "assessment-logs": [
          {
            requirement: { "reference-id": CONTROLS_REF, "entry-id": REQUIREMENT_ID },
            plan: { "reference-id": POLICY_REF, "entry-id": PLAN_ID },
            description: "Inspect raiseIntent actor, intent, and ContextMetadata.signature.",
            result,
            message: input.message,
            applicability: ["propose", "execute", "human-approval-required"],
            steps: [
              "sail-governance.inspectRaiseIntent",
              "sail-governance.decideAllowOrRequireApproval",
            ],
            "steps-executed": "2",
            start,
            end: start,
            "confidence-level": "High",
          },
        ],
      },
    ],
  } as EvaluationLog
}

export function buildEnforcementLog(input: {
  id: string
  actorAppId: string
  intent: string
  decision: GovernanceDecision
  evaluationId: string
}): EnforcementLog {
  const start = isoNow()
  const hold = input.decision === "REQUIRE_APPROVAL"
  const disposition = hold ? "Enforced" : "Clear"
  const evalResult = hold ? "Needs Review" : "Passed"
  return {
    metadata: {
      id: `sail-enf-${input.id}`,
      type: "EnforcementLog",
      version: "0.1.0",
      "gemara-version": "1.2.0",
      date: start,
      description: hold
        ? `Held ${input.intent} and raised GetApproval`
        : `Forwarded ${input.intent} unchanged`,
      author: author(),
      "mapping-references": [
        ...MAPPING_REFERENCES,
        {
          id: input.evaluationId,
          title: `${input.intent} Evaluation Log`,
          version: "0.1.0",
        },
      ],
    },
    disposition,
    target: {
      id: input.actorAppId,
      name: input.actorAppId,
      type: "Software",
    },
    actions: [
      {
        disposition,
        method: { "reference-id": POLICY_REF, "entry-id": METHOD_ID },
        message: hold
          ? "Park getResult() and post GetApproval to aipa-approvals."
          : "Forward the original raiseIntentRequest.",
        start,
        end: start,
        steps: hold
          ? ["sail-governance.parkGetResult", "sail-governance.postGetApproval"]
          : ["sail-governance.forward"],
        justification: {
          assessments: [
            {
              result: evalResult,
              requirement: { "reference-id": CONTROLS_REF, "entry-id": REQUIREMENT_ID },
              plan: { "reference-id": POLICY_REF, "entry-id": PLAN_ID },
              log: { "reference-id": input.evaluationId, "entry-id": CONTROL_ID },
            },
          ],
        },
      },
    ],
  } as EnforcementLog
}
