// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// CorrectiveActionLog records nonconformities and what was done about them:
// containment, root cause, whether the same weakness exists elsewhere, the
// action taken, and the check that it worked.
//
// ISO/IEC 42001 and ISO/IEC 27001 Clause 10.2, with continual improvement under
// 10.1. Gemara's enforcement log records that something was blocked or
// remediated, which is narrower: ISO wants the cause investigated and the
// system changed so it does not recur.
#CorrectiveActionLog: {
	#Document
	metadata: type: "CorrectiveActionLog"

	// entries are the nonconformities raised
	entries: [#Nonconformity, ...#Nonconformity]

	_uniqueEntryIds: {for i, e in entries {(e.id): i}}
}

// NonconformitySource is what surfaced the problem
#NonconformitySource: "Internal Audit" |
	"External Audit" |
	"Evaluation" |
	"Enforcement" |
	"Incident" |
	"Management Review" |
	"Complaint" |
	"Reported Concern" |
	"Self-identified"

// NonconformityStatus is where the response has got to
#NonconformityStatus: "Open" |
	"Contained" |
	"Investigating" |
	"Action In Progress" |
	"Verifying Effectiveness" |
	"Closed" |
	"Closed - No Action"

// Nonconformity is one failure to meet a requirement, and its treatment
#Nonconformity: {
	// id allows this entry to be referenced by other elements
	id: string

	// title describes the nonconformity at a glance
	title: string

	// description states what did not conform and to what
	description: string

	// requirement is what was not met: a clause, a control, a policy, an
	// obligation
	requirement?: #Reference

	// source is what surfaced it
	source: #NonconformitySource

	// origin references the artifact it came from, such as the evaluation log
	// entry or audit finding that raised it
	origin?: #Reference

	// severity is how serious the nonconformity is
	severity: #Severity

	// detected is when it was found
	detected: gemara.#Datetime

	// owner is accountable for resolving it
	owner: gemara.#Contact

	// containment is what was done immediately to control the consequences,
	// before the cause is understood
	containment?: #Containment

	// root-cause is the investigation of why it happened. ISO asks whether
	// the nonconformity could recur or exist elsewhere, so the finding is
	// separate from the immediate correction.
	"root-cause"?: #RootCause

	// actions are the corrective actions taken to stop recurrence
	actions?: [#Action, ...#Action]

	// changes are the artifacts amended as a result. Clause 10.2 requires the
	// management system itself to be updated where necessary, which is the
	// step most often missed.
	changes?: [#Reference, ...#Reference]

	// effectiveness is the check that the corrective action worked
	effectiveness?: #EffectivenessCheck

	// status is where the response has got to
	status: #NonconformityStatus

	// closed is when the entry was closed
	closed?: gemara.#Datetime

	// evidence substantiates the response
	evidence?: [#Evidence, ...#Evidence]

	// a closed entry has to show its work
	if status == "Closed" {
		"root-cause"!: #RootCause
		effectiveness!: #EffectivenessCheck
		closed!:        gemara.#Datetime
	}
}

// Containment is the immediate response, before cause is understood
#Containment: {
	// description states what was done
	description: string

	// taken is when it was done
	taken?: gemara.#Datetime

	// by is who did it
	by?: gemara.#Contact
}

// RootCause is why the nonconformity happened, and where else it might apply
#RootCause: {
	// method is how the cause was investigated
	method?: string

	// statement is the cause identified
	statement: string

	// category groups causes so patterns can be read across entries
	category?: "Process" |
		"Technical" |
		"Human" |
		"Supplier" |
		"Design" |
		"Documentation" |
		"Competence" |
		"Governance"

	// systemic states whether the same cause could produce the same failure
	// elsewhere, which Clause 10.2 requires to be considered
	systemic: bool

	// elsewhere names where else it applies, when systemic
	elsewhere?: [#Reference, ...#Reference]

	// determined is when the investigation concluded
	determined?: gemara.#Datetime
}

// EffectivenessCheck is the verification that a corrective action worked
#EffectivenessCheck: {
	// method is how effectiveness was tested
	method: string

	// date is when it was tested
	date: gemara.#Datetime

	// result is the outcome
	result: "Effective" | "Partially Effective" | "Not Effective"

	// narrative explains the result
	narrative?: string

	// evidence substantiates it
	evidence?: [#Evidence, ...#Evidence]
}
