// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// ManagementReview is the record of top management examining the management
// system for continuing suitability, adequacy and effectiveness: what they
// considered, what they decided and what they committed to.
//
// ISO/IEC 42001 and ISO/IEC 27001 Clause 9.3. Gemara's owners review evidence
// and improve governance, which is local review; this is the periodic
// management-level examination ISO requires, and the inputs it must consider
// are enumerated by the standard rather than left to the reviewer.
#ManagementReview: {
	#Document
	metadata: type: "ManagementReview"

	// period is the window under review
	period: #Period

	// date is when the review was held
	date: gemara.#Datetime

	// chair is who led the review. ISO places this duty on top management, so
	// the chair identifies whether that duty was discharged.
	chair: gemara.#Contact

	// attendees are the parties who took part
	attendees: [#Reference, ...#Reference]

	// inputs are what the review considered. The standard enumerates these,
	// so the structure follows the clause rather than the meeting agenda.
	inputs: #ReviewInputs

	// findings are the conclusions drawn about suitability, adequacy and
	// effectiveness
	findings: [#ReviewFinding, ...#ReviewFinding]

	// decisions are the rulings taken
	decisions?: [#ReviewDecision, ...#ReviewDecision]

	// actions are the improvements and changes committed to
	actions?: [#Action, ...#Action]

	// next-review is when the next one is due
	"next-review"?: gemara.#Datetime

	// evidence substantiates that the review happened as recorded
	evidence?: [#Evidence, ...#Evidence]

	_uniqueFindingIds: {for i, f in findings {(f.id): i}}
	if decisions != _|_ {
		_uniqueDecisionIds: {for i, d in decisions {(d.id): i}}
	}
	if actions != _|_ {
		_uniqueActionIds: {for i, a in actions {(a.id): i}}
	}
}

// ReviewInputs are the matters Clause 9.3 requires a review to consider
#ReviewInputs: {
	// prior-actions is the status of actions from previous reviews
	"prior-actions"?: [#Reference, ...#Reference]

	// context-changes are external and internal changes bearing on the
	// management system since the last review
	"context-changes"?: [#Reference, ...#Reference]

	// party-feedback is what interested parties have said
	"party-feedback"?: [string, ...string]

	// objectives is performance against the management objectives
	objectives?: [#Reference, ...#Reference]

	// evaluation-results are the monitoring and measurement results, typically
	// Gemara evaluation logs
	"evaluation-results"?: [#Reference, ...#Reference]

	// audit-results are the internal and external audit outcomes
	"audit-results"?: [#Reference, ...#Reference]

	// nonconformities are the nonconformities and corrective actions raised
	nonconformities?: [#Reference, ...#Reference]

	// incidents are the incidents in the period
	incidents?: [#Reference, ...#Reference]

	// risk-status is the state of the risk assessment and treatment
	"risk-status"?: [#Reference, ...#Reference]

	// impact-status is the state of impact assessments, where the standard
	// requires them
	"impact-status"?: [#Reference, ...#Reference]

	// improvement-opportunities are the openings identified for doing better
	"improvement-opportunities"?: [string, ...string]

	// resource-adequacy is management's assessment of whether the system is
	// adequately resourced
	"resource-adequacy"?: string
}

// ReviewFinding is a conclusion the review reached
#ReviewFinding: {
	// id allows this finding to be referenced by other elements
	id: string

	// subject is what the finding is about
	subject: string

	// assessment is the judgement reached
	assessment: "Suitable" | "Adequate" | "Effective" | "Deficient"

	// narrative explains the judgement
	narrative: string

	// evidence substantiates it
	evidence?: [#Evidence, ...#Evidence]
}

// ReviewDecision is a ruling the review took
#ReviewDecision: {
	// id allows this decision to be referenced by other elements
	id: string

	// decision states what was decided
	decision: string

	// type distinguishes the kind of change being made
	type?: "Scope" |
		"Policy" |
		"Objective" |
		"Resource" |
		"Risk Acceptance" |
		"Improvement" |
		"Other"

	// rationale explains why
	rationale?: string

	// affects are the artifacts the decision changes
	affects?: [#Reference, ...#Reference]

	// decided-by is who took it, where that is not the whole meeting
	"decided-by"?: gemara.#Contact
}
