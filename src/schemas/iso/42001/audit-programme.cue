// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// AuditProgramme is the plan for internal audit: what will be audited, how
// often, by whom, against what, and how independence is assured.
//
// ISO/IEC 42001 Clause 9.2. Gemara's audit log records the result of an audit
// very well. What has nowhere to live is the governance of auditing itself —
// the cadence, the coverage over a cycle, and the requirement that auditors do
// not audit their own work. An audit result is only worth as much as the
// independence of whoever produced it, which is why that is a field here
// rather than an assumption.
#AuditProgramme: {
	iso.#Document
	metadata: type: "AuditProgramme"

	// coverage-cycle is how often the programme must achieve the coverage
	// stated below (for example Annual full AIMS coverage)
	"coverage-cycle": iso.#Cadence

	// objectives state what the programme is for
	objectives: [string, ...string]

	// criteria are what audits assess conformity against: the standard, the
	// organisation's own requirements, or both
	criteria: [#AuditCriterion, ...#AuditCriterion]

	// coverage states what each coverage-cycle must cover, so a gap in the
	// schedule is visible against an intention rather than only in hindsight
	coverage?: [iso.#Reference, ...iso.#Reference]

	// independence states how auditor impartiality is assured
	independence: #Independence

	// competence are the competence requirements auditors must meet
	competence?: [iso.#Reference, ...iso.#Reference]

	// audits are the recurring audit types in the programme
	audits: [#PlannedAudit, ...#PlannedAudit]

	// owner is accountable for the programme; reference a party register entry
	owner: iso.#Reference

	_uniqueAuditIds: {for i, a in audits {(a.id): i}}
}

// AuditCriterion is something audits assess conformity against
#AuditCriterion: {
	// description names the criterion
	description: string

	// reference points at the requirement being audited against
	reference?: iso.#Reference
}

// Independence is how auditor impartiality is assured
#Independence: {
	// requirement states the rule, such as that auditors must not audit work
	// they performed or own
	requirement: string

	// verification states how conformity with the rule is checked
	verification?: string
}

// AuditStatus is where a planned audit has got to for its latest occurrence
#AuditStatus: "Planned" | "Scheduled" | "In Progress" | "Reported" | "Closed" | "Deferred"

// PlannedAudit is one recurring audit in the programme, defined by frequency
#PlannedAudit: {
	// id allows this audit to be referenced by other elements
	id: string

	// title describes the audit at a glance
	title: string

	// scope states what is being audited
	scope: string

	// frequency is how often this audit runs
	frequency: iso.#Cadence

	// subject references the artifacts, systems or activities in scope
	subject?: [iso.#Reference, ...iso.#Reference]

	// criteria narrows the programme criteria for this audit
	criteria?: [#AuditCriterion, ...#AuditCriterion]

	// method is how the audit is conducted
	method?: string

	// auditor is who performs it
	auditor?: gemara.#Actor

	// independence-confirmed records that the auditor's impartiality was
	// checked for the latest occurrence, not merely required by the programme
	"independence-confirmed"?: bool

	// status is where the latest occurrence has got to
	status: #AuditStatus

	// results references the Gemara audit log (or corrective-action entry)
	// the latest occurrence produced
	results?: iso.#Reference

	// findings are the nonconformities raised, in the corrective action log
	findings?: [iso.#Reference, ...iso.#Reference]

	// follow-up states how findings are tracked to closure
	"follow-up"?: string

	// reported-to are the parties the results were given to. Clause 9.2
	// requires results to reach relevant management, so the recipients are
	// part of the record.
	"reported-to"?: [iso.#Reference, ...iso.#Reference]

	if status == "Reported" || status == "Closed" {
		results!: iso.#Reference
	}
}
