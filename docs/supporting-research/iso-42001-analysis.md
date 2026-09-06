---
sidebar_position: 2
title: ISO/IEC 42001 Analysis
description: "Clause-by-clause and Annex A mapping of ISO/IEC 42001 to Ten Factor Governance and Gemara artifacts."
---

# ISO/IEC 42001 Analysis

ISO/IEC 42001 is an organisation-wide Artificial Intelligence Management System (AIMS) standard. [Ten Factor Governance](/docs/factors/) is an architectural model for making governance operable; [Gemara artifacts](/docs/artifacts/) supply the machine-readable GRC definitions and measures.

They are complementary rather than interchangeable: Ten Factor and Gemara align strongly with ISO planning, operation, evaluation and evidence, while the outer management-system envelope (context, leadership, objectives, resources, competence, management review, CAPA) and AI-specific objects (impact assessment, AI system/data/supplier schemas) remain the largest gaps.

**Coverage labels:** **Full** = direct corresponding capability (not by itself ISO conformity); **Partial** = useful machinery exists but an ISO-required element is missing; **Does not cover** / **Not represented** = no material direct representation.

Requirement descriptions below are concise paraphrases of public ISO material, not a substitute for a licensed copy of the standard.

## Clauses and management-system requirements

### 4.1 — Understanding the organisation and its context

Determine internal and external issues relevant to the organisation's purpose and its ability to achieve the intended outcomes of the AIMS.

**Ten Factor — Partial.** [Build a Governance Twin](/docs/factors/build-a-governance-twin) gives each sensitive activity a machine-readable governance representation; [Context In, Decisions Out](/docs/factors/context-in-decisions-out) makes runtime context explicit. Neither is an organisation-level context assessment.

**Gemara — Partial.** [Policy](/docs/artifacts/definitions/policy) supports scoped applicability; [Risk](/docs/artifacts/definitions/risk) captures organisational risks. There is no organisational-context schema.

**Gap:** Both can consume context; neither records the ISO management exercise establishing internal/external context as a first-class artefact.

**Recommended action:** Add a generic **OrganisationContext** artefact/profile covering internal/external issues, jurisdictions, organisational boundaries and change history.

### 4.2 — Needs and expectations of interested parties

Identify interested parties relevant to the AIMS and determine which of their requirements are relevant to the management system.

**Ten Factor — Partial.** [Governance Is Composable](/docs/factors/governance-is-composable) discusses regulator, customer and organisational overlays; [Governance Has Owners](/docs/factors/governance-has-owners) identifies accountable organisations. Interested-party requirements themselves are not represented.

**Gemara — Not represented directly.** [Policy](/docs/artifacts/definitions/policy) has contacts/RACI and scopes but no stakeholder/interested-party register with needs and requirements.

**Gap:** Stakeholders can appear around artefacts, but stakeholder requirements are not a distinct object.

**Recommended action:** Add **InterestedParty** and **StakeholderRequirement** schemas with mappings into [Guidance](/docs/artifacts/definitions/guidance), [Control](/docs/artifacts/definitions/control), [Risk](/docs/artifacts/definitions/risk) and [Policy](/docs/artifacts/definitions/policy).

### 4.3 — Determining the scope of the AIMS

Define the boundaries and applicability of the AIMS, considering organisational context, interested-party requirements and interfaces/dependencies, and maintain the scope as documented information.

**Ten Factor — Partial.** [Govern Sensitive Activities](/docs/factors/govern-sensitive-activities) provides a strong operational boundary; [Govern Dependencies](/docs/factors/govern-dependencies) extends governance through dependency relationships. No formal AIMS scope exists.

**Gemara — Partial.** [Policy](/docs/artifacts/definitions/policy) scope expresses in/out applicability dimensions, but a policy's scope is not necessarily the scope of the organisational AIMS.

**Gap:** Strong operational scoping, weak management-system scoping.

**Recommended action:** Add an **AIMSScope/GovernanceScope** profile referencing organisations, systems, activities, sites, suppliers and exclusions.

### 4.4 — AI management system

Establish, implement, maintain and continually improve the AIMS and the processes/interactions needed for it.

**Ten Factor — Partial, but architecturally strong.** The complete [Ten Factors](/docs/factors/) provide a blueprint for operable governance, especially twins, versioning, evidence and continuous governance.

**Gemara — Partial, but technically strong.** [Governance Artifacts](/docs/artifacts/) connect definition layers, [sensitive activities](/docs/artifacts/activity/) and [measurement layers](/docs/artifacts/measures/). They model GRC activities, not an ISO management system.

**Gap:** Together they provide much of an implementation substrate, but not an explicit AIMS object/process model.

**Recommended action:** Publish an **ISO 42001 profile for Ten Factor/Gemara** rather than changing the core artifact model.

### 5.1 — Leadership and commitment

Top management must demonstrate leadership, integrate AIMS requirements into business processes, provide resources, support relevant roles and promote continual improvement.

**Ten Factor — Partial.** [Governance Has Owners](/docs/factors/governance-has-owners) strongly requires accountability and authority to change governance, approve exceptions and respond to failure. It does not require top-management sponsorship or strategic integration.

**Gemara — Not represented as leadership.** RACI on [Policy](/docs/artifacts/definitions/policy), [Risk](/docs/artifacts/definitions/risk) and [Audit Log](/docs/artifacts/measures/audit-log) expresses roles; executive management commitment is absent.

**Gap:** Accountability is not the same as top-management commitment.

**Recommended action:** Add a **GovernanceAuthority/ManagementCommitment** artefact or AIMS profile identifying executive sponsor, authority, resources and approvals.

### 5.2 — AI policy

Establish an AI policy appropriate to the organisation's purpose and strategic direction, providing a framework for objectives and commitments, and communicate/maintain it.

**Ten Factor — Partial–strong.** [Build a Governance Twin](/docs/factors/build-a-governance-twin) explicitly includes policy; [Governance is Version Controlled](/docs/factors/governance-is-version-controlled) requires reviewed, approved and versioned changes; [Governance Is Composable](/docs/factors/governance-is-composable) supports enterprise and local policy layers.

**Gemara — Partial–strong.** [Policy](/docs/artifacts/definitions/policy) models metadata, RACI, scope, imports, implementation plan, risks and adherence. It is generic and does not itself impose ISO's strategic/leadership commitments.

**Gap:** Excellent operational policy machinery; incomplete ISO organisational-policy semantics.

**Recommended action:** Define an **ISO42001 AI Policy profile** over Gemara Policy with required purpose, commitments, strategic alignment, approver and review cadence.

### 5.3 — Organisational roles, responsibilities and authorities

Assign and communicate responsibilities and authorities needed for the AIMS, including responsibility for ensuring conformity and reporting AIMS performance to top management.

**Ten Factor — Partial–strong.** [Governance Has Owners](/docs/factors/governance-has-owners) says every Twin, artefact and decision needs an accountable owner. It does not define the complete AIMS responsibility structure or reporting chain.

**Gemara — Partial.** RACI is first-class on [Risk](/docs/artifacts/definitions/risk), [Policy](/docs/artifacts/definitions/policy) and [Audit Log](/docs/artifacts/measures/audit-log); there is no organisation-wide role/authority register or explicit top-management reporting responsibility.

**Gap:** Strong object-level accountability, incomplete management-system responsibility model.

**Recommended action:** Add reusable **GovernanceRole / Authority / Escalation** entities referenced by all governance artefacts.

### 6.1.1 — Actions addressing risks and opportunities: general

Plan actions for AI-related risks and opportunities so the AIMS can achieve intended results, prevent undesired effects and improve.

**Ten Factor — Partial.** [Govern Sensitive Activities](/docs/factors/govern-sensitive-activities) starts from unacceptable risk; twins combine risks/controls/policy and [Continuous Governance](/docs/factors/continuous-governance) feeds operational learning back. Opportunities are not first-class.

**Gemara — Partial.** [Risk](/docs/artifacts/definitions/risk) and [Policy](/docs/artifacts/definitions/policy) strongly model negative risks, appetite, mitigation and acceptance. Opportunity is not first-class.

**Gap:** Both are notably stronger on downside risk than positive opportunity management.

**Recommended action:** Extend the management-system profile with **Opportunity** or generalise Risk into an **Effect of Uncertainty** model where needed.

### 6.1.2 — AI risk assessment

Define and apply a repeatable AI risk-assessment process, identifying risks, analysing likelihood/consequences and evaluating them against risk criteria.

**Ten Factor — Partial–strong.** [Build a Governance Twin](/docs/factors/build-a-governance-twin) makes risk part of the activity's governance; [Govern Dependencies](/docs/factors/govern-dependencies) adds inherited supply-chain risk. The method of risk scoring is deliberately not prescribed.

**Gemara — Partial–strong.** [Risk](/docs/artifacts/definitions/risk) represents severity, impact, appetite, rank, threats and RACI ownership. It is generic.

**Gap:** Good representation, but no complete ISO-specific risk-assessment procedure/methodology.

**Recommended action:** Define an **ISO42001 Risk Assessment profile** with assessment context, likelihood, consequence, criteria, date, assessor and review trigger.

### 6.1.3 — AI risk treatment

Select treatment options and controls, determine necessary controls, compare them with Annex A, produce a treatment plan and record applicability, including accepted residual risk. The resulting controls are reflected in the Statement of Applicability.

**Ten Factor — Partial–strong.** Twins link risks, controls and policy; [Governance Is Composable](/docs/factors/governance-is-composable) supports importing selected shared controls; [Governance is Version Controlled](/docs/factors/governance-is-version-controlled) supports explicit exceptions. There is no Statement of Applicability artefact.

**Gemara — Partial–strong.** [Policy](/docs/artifacts/definitions/policy) supports mitigated/accepted risks, imported control catalogues, exclusions, constraints and assessment-requirement modifications. This comes close to SoA mechanics but is not an explicit SoA.

**Gap:** The underlying machinery largely exists, but ISO's explicit applicability decision record does not.

**Recommended action:** Add **ApplicabilityProfile / StatementOfApplicability** mapping each Annex A control to applicable/not-applicable, rationale, implementation state, risk and evidence.

### 6.1.4 — AI system impact assessment

Establish a process for assessing and documenting potential consequences of AI systems on individuals, groups and society, feeding the results into AI risk assessment and treatment.

**Ten Factor — Partial but materially incomplete.** Sensitive activities can include safety/legal/business risks and twins can contain risks, but there is no dedicated impact-assessment model for affected people/groups/society.

**Gemara — Partial but materially incomplete.** [Risk](/docs/artifacts/definitions/risk) has free-text impact; no affected-party, impact scenario, societal context or AI Impact Assessment schema.

**Gap:** Major AI-specific gap in both.

**Recommended action:** Add **ImpactAssessment** and **Impact** schemas mapped to AI system/activity, affected parties, intended/foreseeable use, risks, controls and assessment evidence.

### 6.2 — AI objectives and planning to achieve them

Establish measurable AI objectives aligned with the AI policy; determine actions, resources, responsibilities, timelines and how results will be evaluated, and retain documented information.

**Ten Factor — Does not cover directly.** Controls and governance decisions have objectives implicitly, and owners/continuous governance support delivery, but organisational AIMS objectives and KPIs are absent.

**Gemara — Partial.** [Guidance](/docs/artifacts/definitions/guidance) and [Control](/docs/artifacts/definitions/control) entries can contain an objective, and [Policy](/docs/artifacts/definitions/policy) contains timelines, but these are control/policy objectives rather than measurable organisation-level AI objectives.

**Gap:** No first-class management objectives/metrics model.

**Recommended action:** Add **ManagementObjective / Metric / Target / MeasurementPeriod** artefacts linked to policy, owners and evaluation results.

### 6.3 — Planning of changes

Changes to the AIMS should be carried out in a planned manner, considering purpose, consequences, integrity, resources and responsibilities.

**Ten Factor — Partial–strong.** [Governance is Version Controlled](/docs/factors/governance-is-version-controlled) requires review, testing, approval and promotion of governance changes; [Continuous Governance](/docs/factors/continuous-governance) adds lifecycle feedback.

**Gemara — Partial.** [Policy](/docs/artifacts/definitions/policy) implementation plans model activation timelines; schema metadata/versioning supports artifact evolution. It does not model management-system change rationale/consequences/resources as one object.

**Gap:** TFG is particularly well aligned to controlled governance change; ISO's management-level change planning is broader.

**Recommended action:** Add a **GovernanceChange** record referencing changed artefacts, rationale, impact, owner, approvals, resources and rollout.

### 7.1 — Resources

Determine and provide resources needed to establish, implement, maintain and continually improve the AIMS.

**Ten Factor — Partial.** [Govern Dependencies](/docs/factors/govern-dependencies) treats software, data, services, infrastructure and organisations as dependencies; [Governance Has Owners](/docs/factors/governance-has-owners) notes owners need authority and resources. It is not an AIMS resource-planning process.

**Gemara — Partial/weak.** [Capability](/docs/artifacts/definitions/capability) represents system capabilities; neither models human, financial, data, tooling and computing resources required to run an AIMS.

**Gap:** Resources are dependencies/targets, not management resources.

**Recommended action:** Add a **GovernanceResource** schema/profile covering human, data, tooling, compute, financial and external resources.

### 7.2 — Competence

Determine competence required for people affecting AIMS performance, ensure competence through education/training/experience and retain evidence.

**Ten Factor — Does not cover directly.** [Governance Has Owners](/docs/factors/governance-has-owners) requires owners capable of doing the work, but does not define competence requirements, training or competence evidence.

**Gemara — Partial/indirect.** [Evaluation Log](/docs/artifacts/measures/evaluation-log) can inspect training records if a control requires it, but there is no competence or training schema.

**Gap:** Competence appears only as evidence of something else, not as a first-class concept.

**Recommended action:** Add **CompetenceRequirement**, **TrainingRecord** and mappings to roles/activities.

### 7.3 — Awareness

Relevant personnel should understand the AI policy, their contribution to AIMS effectiveness and implications of nonconformity.

**Ten Factor — Does not cover.** Ownership creates accountability but not workforce awareness.

**Gemara — Does not cover directly.** [Policy](/docs/artifacts/definitions/policy) can identify informed contacts, but awareness campaigns/attestation are absent.

**Gap:** No awareness/attestation mechanism.

**Recommended action:** Add an **AwarenessRequirement/Attestation** mechanism to a management-system profile rather than a new core factor.

### 7.4 — Communication

Determine what AIMS-related communications are required, when they occur, with whom and by what process.

**Ten Factor — Partial/weak.** [Governance Has Owners](/docs/factors/governance-has-owners) supports escalation and incident response, and [Evidence by Default](/docs/factors/evidence-by-default) can be reused for reporting, but no communication plan exists.

**Gemara — Partial.** [Policy](/docs/artifacts/definitions/policy) supports notification processes and non-compliance notification, but there is no general internal/external communication requirement schema.

**Gap:** Exception/noncompliance communication is better represented than general AIMS communication.

**Recommended action:** Add **CommunicationRequirement** with subject, audience, trigger, channel, owner and evidence of communication.

### 7.5 — Documented information

Create, update and control documented information needed by the standard and the organisation, including identification, review/approval, access, storage, protection, versioning, retention and disposition.

**Ten Factor — Partial–strong.** [Governance is Version Controlled](/docs/factors/governance-is-version-controlled) requires governance to be versioned, reviewed, tested and promoted with a history of change. It is weaker on generic records management such as retention/disposition/access protection.

**Gemara — Partial–strong.** Machine-readable [definitions](/docs/artifacts/definitions/) and [measures](/docs/artifacts/measures/) give artefacts stable structure and identity. Generic document retention/disposition/access management is not.

**Gap:** Excellent “governance as code”; incomplete records-management semantics.

**Recommended action:** Extend common metadata with **approval, effective date, supersession, retention, disposition and access-classification** fields where appropriate.

### 8.1 — Operational planning and control

Plan, implement and control processes needed to meet AIMS requirements and implement Clause 6 actions; establish criteria, operate to those criteria and manage planned/unintended changes and externally provided processes.

**Ten Factor — Partial–strong / closest alignment.** [Govern Sensitive Activities](/docs/factors/govern-sensitive-activities), [Build a Governance Twin](/docs/factors/build-a-governance-twin), [Context In, Decisions Out](/docs/factors/context-in-decisions-out), [Continuous Governance](/docs/factors/continuous-governance) and [Govern Dependencies](/docs/factors/govern-dependencies) together establish governed activities, definitions, decision boundaries, continuous verification and external dependencies.

**Gemara — Partial–strong.** [Policy](/docs/artifacts/definitions/policy), [Control](/docs/artifacts/definitions/control), [Evaluation Log](/docs/artifacts/measures/evaluation-log) and [Enforcement Log](/docs/artifacts/measures/enforcement-log) provide a concrete policy→assessment→action pipeline.

**Gap:** Both operationalise this better than most document-centric frameworks, but neither alone defines the complete AIMS process estate.

**Recommended action:** Document a normative **Governed Activity lifecycle** profile showing ISO planning criteria → Twin → Policy/Controls → Evaluation/Enforcement.

### 8.2 — AI risk assessment in operation

Perform AI risk assessments at planned intervals and when significant changes are proposed or occur, retaining results.

**Ten Factor — Partial.** [Continuous Governance](/docs/factors/continuous-governance) and [Govern Dependencies](/docs/factors/govern-dependencies) provide excellent triggers for reassessment when implementation, data/model or dependencies change.

**Gemara — Partial–strong.** [Risk](/docs/artifacts/definitions/risk) records risk state; [Policy](/docs/artifacts/definitions/policy) assessment plans include frequency and [Evaluation Log](/docs/artifacts/measures/evaluation-log) can record resulting assessments.

**Gap:** Missing a first-class time-stamped RiskAssessment record tying methodology, inputs and conclusions together.

**Recommended action:** Add **RiskAssessmentLog** or enrich Risk with assessment instances/history.

### 8.3 — AI risk treatment in operation

Implement the risk-treatment plan and retain documented results.

**Ten Factor — Partial–strong.** Twin policy/controls, [Context In, Decisions Out](/docs/factors/context-in-decisions-out), [Continuous Governance](/docs/factors/continuous-governance) and [Evidence by Default](/docs/factors/evidence-by-default) operationalise treatment rather than leaving it in a plan.

**Gemara — Partial–strong.** [Policy](/docs/artifacts/definitions/policy) records mitigated/accepted risks and assessment/enforcement plans; [Evaluation Log](/docs/artifacts/measures/evaluation-log) and [Enforcement Log](/docs/artifacts/measures/enforcement-log) provide execution evidence.

**Gap:** Strong execution chain; weaker formal treatment-plan/status artefact.

**Recommended action:** Add treatment status, owner, due date and residual-risk decision to the proposed **Applicability/RiskTreatment** profile.

### 8.4 — AI system impact assessment in operation

Perform AI-system impact assessments at planned intervals and when relevant changes occur, and retain the results.

**Ten Factor — Partial/weak.** [Continuous Governance](/docs/factors/continuous-governance) provides change triggers, but impact assessment itself is not represented.

**Gemara — Partial/weak.** [Evaluation Log](/docs/artifacts/measures/evaluation-log) could execute such an assessment if controls described it, but there is no ImpactAssessment schema.

**Gap:** Partial mechanism, missing object — major gap.

**Recommended action:** Add the proposed **ImpactAssessment** schema with review frequency/change triggers and Evaluation Log mappings.

### 9.1 — Monitoring, measurement, analysis and evaluation

Determine what should be monitored/measured, methods and timing, analyse results and evaluate AIMS performance/effectiveness, retaining evidence.

**Ten Factor — Partial–strong.** [Evidence by Default](/docs/factors/evidence-by-default) makes evidence an ordinary output; [Continuous Governance](/docs/factors/continuous-governance) continuously tests and observes behaviour/drift. Organisational KPIs are not first-class.

**Gemara — Partial–strong.** [Evaluation Log](/docs/artifacts/measures/evaluation-log) records assessment results and evidence; [measures](/docs/artifacts/measures/) define continuous monitoring as aggregation of evaluation and operational metrics.

**Gap:** Excellent control-level observability; incomplete AIMS objective/KPI performance model.

**Recommended action:** Add **Metric/ObjectiveResult** alongside Evaluation Log and allow ManagementReview to consume it.

### 9.2 — Internal audit

Conduct internal audits at planned intervals to determine whether the AIMS conforms to organisational and ISO requirements and is effectively implemented; maintain an audit programme, impartiality and results.

**Ten Factor — Partial.** [Governance Measures](/docs/artifacts/measures/) includes audit reviewing evaluation/enforcement evidence; [Evidence by Default](/docs/factors/evidence-by-default) and [Governance Has Owners](/docs/factors/governance-has-owners) support auditability. An audit programme/independence model is not supplied.

**Gemara — Partial–strong.** [Audit Log](/docs/artifacts/measures/audit-log) records audit criteria, results, evidence, RACI owner and corrective recommendations. It does not itself establish the full independent audit programme.

**Gap:** Audit results are well represented; audit governance is not.

**Recommended action:** Add **AuditProgramme** with scope, cadence, auditor independence/competence, schedule and follow-up.

### 9.3 — Management review

Top management reviews the AIMS at planned intervals for continuing suitability, adequacy and effectiveness, considering changes, performance, audits, nonconformities and prior actions; decisions/actions are recorded.

**Ten Factor — Partial but not equivalent.** [Governance Has Owners](/docs/factors/governance-has-owners) says owners review evidence, investigate failures and publish improvements, which resembles local governance review; formal top-management AIMS review is not represented.

**Gemara — Not represented directly.** [Audit Log](/docs/artifacts/measures/audit-log) can produce evidence/recommendations, but there is no ManagementReview schema capturing mandated inputs and management decisions.

**Gap:** One of the largest management-system gaps.

**Recommended action:** Add **ManagementReview** with period, attendees, context changes, objectives/KPIs, audit/NCR/risk inputs, decisions, resources and improvement actions.

### 10.1 — Continual improvement

Continually improve the suitability, adequacy and effectiveness of the AIMS.

**Ten Factor — Partial–strong.** [Continuous Governance](/docs/factors/continuous-governance) creates an engineering feedback loop; [Governance Has Owners](/docs/factors/governance-has-owners) explicitly says owners turn evidence and incidents into improved governance.

**Gemara — Partial.** [Audit Log](/docs/artifacts/measures/audit-log) recommendations, [Evaluation Log](/docs/artifacts/measures/evaluation-log), [Enforcement Log](/docs/artifacts/measures/enforcement-log) and continuous monitoring generate improvement inputs, but there is no first-class management-system improvement cycle.

**Gap:** TFG captures the engineering spirit very well; neither captures the formal AIMS-wide process.

**Recommended action:** Add **ImprovementAction** linked from review/audit/evaluation back to risk, policy, control and objective revisions.

### 10.2 — Nonconformity and corrective action

React to nonconformity, control/correct consequences, investigate causes and possible recurrence elsewhere, implement corrective action, verify effectiveness, update the AIMS if necessary and retain evidence.

**Ten Factor — Partial.** [Continuous Governance](/docs/factors/continuous-governance) identifies failures; [Governance Has Owners](/docs/factors/governance-has-owners) investigate and improve governance; [Evidence by Default](/docs/factors/evidence-by-default) records what happened. Root-cause/CAPA lifecycle and effectiveness review are not first-class.

**Gemara — Partial–strong for remediation, incomplete for CAPA.** [Enforcement Log](/docs/artifacts/measures/enforcement-log) records actions in response to non-compliance; [Audit Log](/docs/artifacts/measures/audit-log) supports corrective recommendations. Neither models root cause, recurrence analysis, effectiveness verification and closure as one lifecycle.

**Gap:** “Enforcement” is narrower than ISO corrective action.

**Recommended action:** Add **Nonconformity/CAPA** with containment, root cause, systemic scope, corrective action, owner, deadline, effectiveness test and closure.

## Annex A reference controls

### A.2.2 — AI policy

Establish and maintain an organisational policy governing responsible AI development/use.

**Ten Factor — Partial–strong.** [Build a Governance Twin](/docs/factors/build-a-governance-twin) includes policy; [Governance is Version Controlled](/docs/factors/governance-is-version-controlled) makes it reviewable/versioned.

**Gemara — Partial–strong.** [Policy](/docs/artifacts/definitions/policy) directly represents scoped policy, RACI, imports, risks, implementation and adherence.

**Gap:** Neither enforces AI-specific policy content by schema.

**Recommended action:** Publish an **AI Policy profile/catalogue** over Gemara.

### A.2.3 — Alignment with other organisational policies

Align AI policy with related organisational policies and obligations.

**Ten Factor — Full at architectural level.** [Governance Is Composable](/docs/factors/governance-is-composable): enterprise, business-unit, customer and regulatory governance can be imported/overlaid rather than copied.

**Gemara — Full at artefact level.** [Policy](/docs/artifacts/definitions/policy) imports explicitly pull in other policies, controls and guidance.

**Gap:** The organisation must still define the actual relationships.

**Recommended action:** Create mappings/profiles for common AI, security, privacy and data policies.

### A.2.4 — Review of AI policy

Review the AI policy at defined intervals and when relevant changes warrant it.

**Ten Factor — Partial–strong.** [Governance is Version Controlled](/docs/factors/governance-is-version-controlled), [Continuous Governance](/docs/factors/continuous-governance) and [Governance Has Owners](/docs/factors/governance-has-owners) provide a strong review/evolution model.

**Gemara — Partial.** [Policy](/docs/artifacts/definitions/policy) has implementation timelines and assessment plans can specify frequency, but policy review itself is not a dedicated record.

**Gap:** Review mechanics exist; a dedicated review record does not.

**Recommended action:** Add `review-cadence`, `last-reviewed`, `next-review`, approver and review evidence to AI Policy profile.

### A.3.2 — AI roles and responsibilities

Define and allocate roles and responsibilities for AI governance and lifecycle activities.

**Ten Factor — Partial–strong.** [Governance Has Owners](/docs/factors/governance-has-owners) is directly relevant.

**Gemara — Partial–strong.** RACI on [Policy](/docs/artifacts/definitions/policy), [Risk](/docs/artifacts/definitions/risk) and [Audit Log](/docs/artifacts/measures/audit-log) represents accountable/responsible/consulted/informed contacts.

**Gap:** Missing organisation-wide role/authority catalogue.

**Recommended action:** Add reusable **GovernanceRole** and lifecycle responsibilities.

### A.3.3 — Reporting of concerns

Provide mechanisms through which AI-related concerns can be reported and handled.

**Ten Factor — Does not cover directly.** Owner escalation and incident response are mentioned, but there is no concerns/whistleblowing mechanism.

**Gemara — Does not cover directly.** [Policy](/docs/artifacts/definitions/policy) non-compliance notifications are adjacent but not a reporting-of-concerns system.

**Gap:** No concerns/issue-report artefact.

**Recommended action:** Add **Concern/IssueReport** and escalation/triage workflow.

### A.4.2 — Resource documentation

Identify and document resources relevant to AI systems and responsible AI management.

**Ten Factor — Partial.** [Govern Dependencies](/docs/factors/govern-dependencies) provides the strongest conceptual fit, covering software, data, services, infrastructure, organisations and activities.

**Gemara — Partial.** [Capability](/docs/artifacts/definitions/capability) models system capabilities; this is not a complete AI resource inventory.

**Gap:** Concept exists; inventory schema does not.

**Recommended action:** Add **Resource/Asset Catalog** with type, owner, provenance, lifecycle and relationships.

### A.4.3 — Data resources

Identify and manage data resources needed across the AI lifecycle.

**Ten Factor — Partial concept.** [Govern Dependencies](/docs/factors/govern-dependencies) explicitly treats data as a governance dependency. No data-resource artefact exists.

**Gemara — Does not cover directly.** No dataset/data-resource schema among [definitions](/docs/artifacts/definitions/).

**Gap:** Data is recognised as a dependency, not modelled as a governed object.

**Recommended action:** Add **Dataset/DataResource** schema with ownership, purpose, sensitivity, rights, provenance and quality.

### A.4.4 — Tooling resources

Identify and govern tools used to develop, evaluate, operate and monitor AI.

**Ten Factor — Partial–strong concept.** [Govern the Factory and the Product Separately](/docs/factors/govern-factory-and-product-separately) and [Govern Dependencies](/docs/factors/govern-dependencies) recognise tooling/build infrastructure as governed dependencies.

**Gemara — Partial.** [Capability](/docs/artifacts/definitions/capability) can describe tools generically; no AI-tool inventory is defined.

**Gap:** Architectural recognition without a ToolResource profile.

**Recommended action:** Introduce **ToolResource** as a Resource/Dependency profile.

### A.4.5 — System and computing resources

Identify computing, infrastructure and system resources required by AI systems.

**Ten Factor — Partial–strong.** [Govern Dependencies](/docs/factors/govern-dependencies) directly includes infrastructure/services.

**Gemara — Partial.** [Capability](/docs/artifacts/definitions/capability) can identify targets/capabilities but lacks structured compute/system resource semantics.

**Gap:** Dependency principle without compute classes.

**Recommended action:** Add compute/infrastructure classes to a generic Resource Catalog, potentially linking to CALM/SBOM representations.

### A.4.6 — Human resources

Identify human expertise and staffing resources needed for responsible AI activities.

**Ten Factor — Partial.** [Governance Has Owners](/docs/factors/governance-has-owners) are required, but workforce capacity and competence are not represented.

**Gemara — Partial.** RACI on [Policy](/docs/artifacts/definitions/policy) names people/groups but not staffing capacity or required competencies.

**Gap:** Named people ≠ capacity/competence model.

**Recommended action:** Add Role + Competence + Capacity/Resource requirements in the management profile.

### A.5.2 — AI-system impact-assessment process

Establish a systematic process for assessing AI-system impacts.

**Ten Factor — Does not cover directly.** Twins can contain risk but not an impact-assessment process.

**Gemara — Does not cover directly.** [Evaluation Log](/docs/artifacts/measures/evaluation-log) can execute tests but lacks the impact model.

**Gap:** Major gap.

**Recommended action:** Add **ImpactAssessment** compatible with ISO/IEC 42005 concepts.

### A.5.3 — Documentation of impact assessments

Document impact assessments and their results sufficiently for governance and review.

**Ten Factor — Partial mechanism.** [Governance is Version Controlled](/docs/factors/governance-is-version-controlled) and [Evidence by Default](/docs/factors/evidence-by-default) provide excellent generic documentation/provenance patterns.

**Gemara — Partial mechanism.** [Evaluation Log](/docs/artifacts/measures/evaluation-log) and [Audit Log](/docs/artifacts/measures/audit-log) can record evidence and outcomes but lack the actual impact-assessment object.

**Gap:** Documentation machinery without the object being documented.

**Recommended action:** Make ImpactAssessment a versioned Gemara artefact with Evidence mappings.

### A.5.4 — Impact on individuals or groups

Assess consequences for affected individuals and groups, including potentially differentiated impacts.

**Ten Factor — Does not cover directly.** Sensitive activities can be risk-scoped, but affected-person/group semantics are absent.

**Gemara — Partial/weak.** [Risk](/docs/artifacts/definitions/risk)'s generic impact free text is insufficient to model affected groups systematically.

**Gap:** No AffectedParty model.

**Recommended action:** Add **AffectedParty/Group**, impact category, magnitude, likelihood, reversibility and mitigation.

### A.5.5 — Societal impacts

Assess wider societal impacts arising from AI systems.

**Ten Factor — Does not cover.**

**Gemara — Does not cover directly.** Beyond generic [Risk](/docs/artifacts/definitions/risk) impact text.

**Gap:** No societal/public-interest impact semantics.

**Recommended action:** Extend Impact schema to societal/public-interest/environmental consequences and affected communities.

### A.6.1.2 — Objectives for responsible development

Establish responsible-development objectives for AI systems.

**Ten Factor — Partial–strong.** [Govern the Factory and the Product Separately](/docs/factors/govern-factory-and-product-separately) makes development a separately governed sensitive activity; [Build a Governance Twin](/docs/factors/build-a-governance-twin) can contain its controls/policy.

**Gemara — Partial.** [Control](/docs/artifacts/definitions/control) and [Guidance](/docs/artifacts/definitions/guidance) entries have objectives, but no AI-development objective class.

**Gap:** Factory governance without management-objective artefacts.

**Recommended action:** Add **ResponsibleDevelopmentObjective** as a profile of management objectives/controls.

### A.6.1.3 — Processes for responsible AI design and development

Define and operate processes for responsible AI system design/development.

**Ten Factor — Partial–strong.** [Govern the Factory and the Product Separately](/docs/factors/govern-factory-and-product-separately) is unusually well aligned: model training/evaluation/promotion and runtime are separate governed domains.

**Gemara — Partial.** [Sensitive Activity](/docs/artifacts/activity/) represents the hinge between definitions and measures without a universal activity schema, so development processes can be governed but are not structurally described as AI lifecycle steps.

**Gap:** Architectural separation without an AI lifecycle activity profile.

**Recommended action:** Define an **AI lifecycle activity profile** rather than forcing generic Gemara to model every engineering process.

### A.6.2.2 — AI-system requirements and specification

Define and document requirements for the AI system, including responsible-use/trustworthiness needs relevant to its context.

**Ten Factor — Partial.** [Build a Governance Twin](/docs/factors/build-a-governance-twin) provides the governance half of specification, distinguishing it from implementation rather than defining a complete system-requirements model.

**Gemara — Partial.** [Control](/docs/artifacts/definitions/control) assessment requirements specify governance conditions; no AI System Requirement schema describes functional/non-functional system requirements as such.

**Gap:** Governance requirements ≠ system requirements.

**Recommended action:** Add/bridge to an **AI System/Architecture Requirement** model, possibly via CALM, rather than duplicating architecture languages.

### A.6.2.3 — Documentation of AI design and development

Maintain appropriate records and documentation of AI-system design/development.

**Ten Factor — Partial.** [Build a Governance Twin](/docs/factors/build-a-governance-twin) and [Governance is Version Controlled](/docs/factors/governance-is-version-controlled) document how the system is governed, not necessarily technical model/system design.

**Gemara — Does not cover technical documentation directly.** [Definitions](/docs/artifacts/definitions/) document GRC artefacts, not model architecture/training/design records.

**Gap:** GRC docs ≠ technical design docs.

**Recommended action:** Add **AI System reference** to external Model Card/System Card/architecture/development-record artefacts rather than embedding all content.

### A.6.2.4 — AI-system verification and validation

Verify/validate AI systems against defined requirements before and during lifecycle transitions as appropriate.

**Ten Factor — Full architectural fit.** [Continuous Governance](/docs/factors/continuous-governance) requires build-time validation, UAT behavioural tests and production verification.

**Gemara — Full assessment-mechanism fit; AI-specific test content must be supplied.** [Control](/docs/artifacts/definitions/control) assessment requirements are verifiable conditions; [Evaluation Log](/docs/artifacts/measures/evaluation-log) records their execution/results.

**Gap:** Mechanism is ready; AI validation catalogues still need authoring.

**Recommended action:** Publish reusable AI validation/evaluation Control Catalogues and AssessmentRequirements.

### A.6.2.5 — AI-system deployment

Establish controls around deployment/release of AI systems into target environments.

**Ten Factor — Full architectural fit.** [Governance is Version Controlled](/docs/factors/governance-is-version-controlled), [Govern the Factory and the Product Separately](/docs/factors/govern-factory-and-product-separately) and [Continuous Governance](/docs/factors/continuous-governance) govern promotion through environments and separate factory controls from runtime.

**Gemara — Partial–strong.** [Policy](/docs/artifacts/definitions/policy) implementation timelines, [Evaluation Log](/docs/artifacts/measures/evaluation-log) and [Enforcement Log](/docs/artifacts/measures/enforcement-log) can create deployment gates. No dedicated AI Deployment event/release object.

**Gap:** Gates exist; deployment/release identity does not.

**Recommended action:** Add mappings from deployment/release attestations into Evidence/Evaluation rather than a heavyweight new schema.

### A.6.2.6 — AI-system operation and monitoring

Define how the AI system is operated and monitored after deployment, including ongoing performance/control oversight.

**Ten Factor — Full architectural fit.** [Continuous Governance](/docs/factors/continuous-governance) and [Evidence by Default](/docs/factors/evidence-by-default) are directly aligned; [Govern the Factory and the Product Separately](/docs/factors/govern-factory-and-product-separately) separately governs production inference/behaviour.

**Gemara — Partial–strong.** [Measures](/docs/artifacts/measures/) define continuous monitoring aggregating evaluations and operational metrics; no dedicated ContinuousMonitoringLog schema.

**Gap:** Concept present; dedicated monitoring result profile optional.

**Recommended action:** Add/standardise a **Continuous Monitoring result/profile** or map telemetry to Evaluation Log.

### A.6.2.7 — AI-system technical documentation

Produce and maintain technical documentation sufficient to understand and govern the AI system.

**Ten Factor — Partial.** Twin documents governance; version control preserves evolution; neither defines AI technical documentation content.

**Gemara — Does not cover directly.** GRC documentation, not an AI technical-documentation schema.

**Gap:** Need an AI System descriptor with external doc links.

**Recommended action:** Define an **AI System descriptor** with links to model cards, architecture, interfaces, limitations, versions and evaluation reports.

### A.6.2.8 — AI-system event logs

Establish appropriate logging of events associated with AI operation for traceability and investigation.

**Ten Factor — Full principle.** [Evidence by Default](/docs/factors/evidence-by-default): activities should emit attributable, machine-readable evidence identifying who/when/governance/outcome.

**Gemara — Partial.** [Evaluation Log](/docs/artifacts/measures/evaluation-log), [Enforcement Log](/docs/artifacts/measures/enforcement-log) and [Audit Log](/docs/artifacts/measures/audit-log) are specialised governance logs; they do not replace a generic operational AI event log.

**Gap:** Governance evidence ≠ operational AI event log.

**Recommended action:** Define a standard **evidence/event envelope** or map external telemetry/event logs into Gemara Evidence.

### A.7.2 — Data for development and enhancement

Govern datasets used to develop, train, test or improve AI systems.

**Ten Factor — Partial.** [Govern Dependencies](/docs/factors/govern-dependencies) recognises data; [Govern the Factory and the Product Separately](/docs/factors/govern-factory-and-product-separately) distinguishes development from runtime; no dataset governance schema exists.

**Gemara — Does not cover directly.** No data lifecycle semantics among [definitions](/docs/artifacts/definitions/).

**Gap:** Need Dataset artefact.

**Recommended action:** Add **Dataset** artefact with lifecycle purpose/allowed uses and AI-system mappings.

### A.7.3 — Acquisition of data

Define governance for acquiring data, including source/provenance and relevant obligations.

**Ten Factor — Partial.** [Govern Dependencies](/docs/factors/govern-dependencies) is conceptually strong for source/supply-chain provenance.

**Gemara — Does not cover directly.** Generic mappings/evidence could reference sources, but no data-acquisition record/schema exists.

**Gap:** Provenance principle without acquisition fields.

**Recommended action:** Add `source`, licence/rights, consent/basis, acquisition method/date and supplier to Dataset schema.

### A.7.4 — Quality of data

Define and assess data quality appropriate to the AI system's intended purpose.

**Ten Factor — Partial–strong concept.** [Govern Dependencies](/docs/factors/govern-dependencies) explicitly notes data quality as a dependency whose changes can require reevaluation.

**Gemara — Partial mechanism.** [Evaluation Log](/docs/artifacts/measures/evaluation-log) can test a control requiring data quality, but there is no standard DataQuality object/metrics.

**Gap:** Evaluable without a shared quality model.

**Recommended action:** Add **DataQualityAssessment** or dataset quality attributes with Evaluation mappings.

### A.7.5 — Data provenance

Maintain information about origin, lineage and provenance of AI data.

**Ten Factor — Partial–strong.** [Govern Dependencies](/docs/factors/govern-dependencies) plus [Evidence by Default](/docs/factors/evidence-by-default) are strongly aligned with provenance principles.

**Gemara — Partial.** Evidence on [measures](/docs/artifacts/measures/) can name source artefacts/systems, but a dataset lineage graph is absent.

**Gap:** Prefer referencing a standard provenance representation.

**Recommended action:** Reference a standard provenance representation from Dataset rather than reinventing full lineage.

### A.7.6 — Data preparation

Govern preparation/transformation of data used by AI systems and retain appropriate records.

**Ten Factor — Partial.** [Govern the Factory and the Product Separately](/docs/factors/govern-factory-and-product-separately) can make preparation/training pipeline steps sensitive activities; [Evidence by Default](/docs/factors/evidence-by-default) can record them.

**Gemara — Partial mechanism only.** No data-preparation schema; [Evaluation Log](/docs/artifacts/measures/evaluation-log) can assess controls around the process.

**Gap:** Model as governed activities linked to Dataset versions.

**Recommended action:** Model preparation steps as governed [activities](/docs/artifacts/activity/) and link Dataset versions to provenance/evidence.

### A.8.2 — System documentation and information for users

Provide users with information needed to understand and appropriately use the AI system, including relevant characteristics and limitations.

**Ten Factor — Partial.** [Context In, Decisions Out](/docs/factors/context-in-decisions-out) can expose reasons and obligations, and twins hold governance context, but user-facing transparency documentation is not represented.

**Gemara — Partial/weak.** [Guidance](/docs/artifacts/definitions/guidance) can hold explanatory material, but no user-information/system-card schema exists.

**Gap:** Need System Card / user-information references.

**Recommended action:** Add **AI System Information/System Card** references including purpose, limitations, human oversight and expected user behaviour.

### A.8.3 — External reporting

Define processes for required or appropriate external reporting about the AI system.

**Ten Factor — Partial.** [Evidence by Default](/docs/factors/evidence-by-default) can support compliance/audits; [Governance Has Owners](/docs/factors/governance-has-owners) supplies accountable organisations; external reporting obligations are not modelled.

**Gemara — Partial/weak.** [Policy](/docs/artifacts/definitions/policy) notification mechanisms are narrower than an external-reporting regime.

**Gap:** No ReportingObligation artefact.

**Recommended action:** Add **ReportingObligation** linking trigger, recipient, content, deadline, owner and evidence.

### A.8.4 — Communication of incidents

Establish processes for communicating AI incidents to relevant parties as appropriate.

**Ten Factor — Partial.** [Governance Has Owners](/docs/factors/governance-has-owners) incident examples include owner/CISO action and escalation; [Evidence by Default](/docs/factors/evidence-by-default) makes incidents reconstructable. No incident/comms artefact exists.

**Gemara — Partial.** [Enforcement Log](/docs/artifacts/measures/enforcement-log) and [Policy](/docs/artifacts/definitions/policy) non-compliance notifications capture adjacent concepts; no generic Incident + stakeholder communication object.

**Gap:** Adjacent enforcement/notification ≠ incident communication lifecycle.

**Recommended action:** Add **Incident** plus **IncidentCommunication** mappings to Evaluation, Enforcement, affected systems and stakeholders.

### A.8.5 — Information for interested parties

Identify and provide appropriate AI-related information to relevant interested parties.

**Ten Factor — Partial.** [Governance Is Composable](/docs/factors/governance-is-composable) recognises customers/regulators/suppliers but no stakeholder-information requirement exists.

**Gemara — Does not cover directly.**

**Gap:** Reuse proposed InterestedParty + CommunicationRequirement schemas.

**Recommended action:** Reuse proposed **InterestedParty + CommunicationRequirement** schemas.

### A.9.2 — Processes for responsible use

Define processes ensuring AI systems are used responsibly and consistently with organisational policy.

**Ten Factor — Full architectural fit.** [Govern Sensitive Activities](/docs/factors/govern-sensitive-activities), [Build a Governance Twin](/docs/factors/build-a-governance-twin) and [Context In, Decisions Out](/docs/factors/context-in-decisions-out) provide a particularly good architecture for use-time controls.

**Gemara — Full generic governance fit.** [Policy](/docs/artifacts/definitions/policy), [Control](/docs/artifacts/definitions/control), [Evaluation Log](/docs/artifacts/measures/evaluation-log) and [Enforcement Log](/docs/artifacts/measures/enforcement-log) directly support policy-governed use. AI-specific policy content still has to be authored.

**Gap:** Author the catalogue; architecture is ready.

**Recommended action:** Publish reusable responsible-use controls/assessment requirements as a Gemara catalogue.

### A.9.3 — Objectives for responsible use

Establish objectives guiding responsible use of AI systems.

**Ten Factor — Does not cover directly.** Policies/owners can implement such objectives indirectly.

**Gemara — Partial.** [Control](/docs/artifacts/definitions/control) objectives exist but organisation-level responsible-use objectives/KPIs do not.

**Gap:** Reuse proposed ManagementObjective/Metric artefact.

**Recommended action:** Reuse proposed **ManagementObjective/Metric** artefact.

### A.9.4 — Intended use of the AI system

Identify and govern the AI system's intended use and ensure use remains consistent with that intent.

**Ten Factor — Partial–strong.** [Govern Sensitive Activities](/docs/factors/govern-sensitive-activities), [Build a Governance Twin](/docs/factors/build-a-governance-twin) and [Context In, Decisions Out](/docs/factors/context-in-decisions-out) strongly support contextual permitted use, but there is no first-class AI `intended-use` object.

**Gemara — Partial.** [Policy](/docs/artifacts/definitions/policy) scope can restrict technologies, users, geography and sensitivity; intended/foreseeable use is not explicit.

**Gap:** Need intended use fields on an AI System schema.

**Recommended action:** Add intended use, prohibited use, foreseeable misuse and user classes to **AI System** schema.

### A.10.2 — Allocating responsibilities

Allocate AI governance responsibilities between the organisation and relevant external parties.

**Ten Factor — Partial–strong.** [Govern Dependencies](/docs/factors/govern-dependencies) and [Governance Has Owners](/docs/factors/governance-has-owners) are especially strong; [Governance Is Composable](/docs/factors/governance-is-composable) supports governance contracts between independently implemented systems.

**Gemara — Partial.** RACI and [Policy](/docs/artifacts/definitions/policy) contacts cover internal responsibility; mappings/imports relate external artefacts but not contractual responsibility allocation.

**Gap:** Need PartyResponsibility / GovernanceContract.

**Recommended action:** Add **PartyResponsibility / GovernanceContract** mapping organisation, obligation, activity/system and evidence.

### A.10.3 — Suppliers

Establish appropriate governance for suppliers contributing AI systems/services/resources and their obligations.

**Ten Factor — Full architectural principle.** [Govern Dependencies](/docs/factors/govern-dependencies) is directly on point; [Governance Is Composable](/docs/factors/governance-is-composable) describes suppliers publishing reusable governance and customers consuming it through contracts.

**Gemara — Partial.** Imports/mappings can consume supplier controls/guidance/policies but there is no Supplier/Vendor/Contract schema.

**Gap:** Composition principle without Supplier Assurance profile.

**Recommended action:** Add **Supplier/Dependency Assurance** profile with contract obligations, attestations, versions, risk, controls and evidence.

### A.10.4 — Customers

Define and communicate appropriate responsibilities between the organisation and customers concerning AI systems/services.

**Ten Factor — Partial–strong.** [Governance Has Owners](/docs/factors/governance-has-owners) discusses provider commitments, customer reliance and contractual remedies; [Governance Is Composable](/docs/factors/governance-is-composable) provides the architecture.

**Gemara — Partial.** [Policy](/docs/artifacts/definitions/policy) can scope users/groups and provide contacts but cannot model customer/provider responsibility agreements.

**Gap:** Generalise GovernanceContract to customer relationships.

**Recommended action:** Generalise **GovernanceContract/PartyResponsibility** to supplier, provider and customer relationships.

## Synthesis

Across Annex A, **Ten Factor often has the right architectural principle but not the domain object**, while **Gemara often has the right GRC mechanism but not the AI-specific schema**. Deployment, verification/validation, operation/monitoring, event evidence, responsible use and supplier governance fit existing factors without inventing new principles—the missing work is mostly concrete interoperable artefacts and profiles.

The highest-value additions remain **ImpactAssessment** (largest AI-specific semantic hole) and **ManagementReview/CAPA** (largest management-system structural hole). The intended division of labour:

- **ISO/IEC 42001** — what organisational management system must exist for responsible AI
- **[Ten Factor Governance](/docs/factors/)** — what architectural properties make that governance operable
- **[Gemara artifacts](/docs/artifacts/)** — how governance definitions and measurements are represented and exchanged
