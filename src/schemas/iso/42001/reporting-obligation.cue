// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// ReportingObligationRegister records what the organisation must report about
// its AI systems to parties outside it, and whether it has.
//
// ISO/IEC 42001 Annex A.8.3 (external reporting), read with A.8.5 (information
// for interested parties). This is deliberately narrower than the
// communication plan: a communication requirement is something the
// organisation has decided to do, and a reporting obligation is something it
// is required to do by a regulator, a contract or the law, where lateness is
// itself the breach.
#ReportingObligationRegister: {
	iso.#Document
	metadata: type: "ReportingObligationRegister"

	// obligations are the external reports owed
	obligations: [#ReportingObligation, ...#ReportingObligation]

	// review states how often the register is revisited
	review?: iso.#Review

	_uniqueObligationIds: {for i, o in obligations {(o.id): i}}
}

// ReportingObligation is one report the organisation owes somebody outside it
#ReportingObligation: {
	// id allows this obligation to be referenced by other elements
	id: string

	// title describes the obligation at a glance
	title: string

	// recipient references the party the report goes to
	recipient: iso.#Reference

	// requirement references the stakeholder requirement that imposes it
	requirement?: iso.#Reference

	// authority names the law, regulation or contract requiring the report
	authority?: string

	// jurisdiction is where the obligation applies
	jurisdiction?: string

	// subject references what is being reported on
	subject?: [iso.#Reference, ...iso.#Reference]

	// content states what the report must contain to discharge the obligation
	content: string

	// trigger is what makes a report due
	trigger: #ReportingTrigger

	// deadline is how long there is once the trigger fires
	deadline?: string

	// format is the form the report must take, where prescribed
	format?: string

	// owner is accountable for the report being made
	owner: gemara.#Contact

	// preparation references the artifacts the report is assembled from, so
	// an obligation is traceable to the evidence that answers it
	preparation?: [iso.#Reference, ...iso.#Reference]

	// submissions are the reports actually made
	submissions?: [#ReportSubmission, ...#ReportSubmission]

	// status is the standing of the obligation
	status: "Active" | "Suspended" | "Lapsed"

	// group references a group declared by this document
	group?: string
}

// ReportingTrigger is what makes a report due
#ReportingTrigger: {
	// type distinguishes periodic reporting from event-driven
	type: "Scheduled" | "Event" | "On Request"

	// cadence is the schedule, for periodic reporting
	cadence?: iso.#Cadence

	// event is what makes an event-driven report due, such as a serious
	// incident or a substantial modification
	event?: string

	if type == "Scheduled" {
		cadence!: iso.#Cadence
	}
	if type == "Event" {
		event!: string
	}
}

// ReportSubmission is one report actually made
#ReportSubmission: {
	// id allows this submission to be referenced by other elements
	id: string

	// period is what the report covered, for periodic reports
	period?: iso.#Period

	// due is when it had to be made by
	due?: gemara.#Datetime

	// submitted is when it was made
	submitted: gemara.#Datetime

	// submitted-by is who made it
	"submitted-by"?: gemara.#Contact

	// acknowledged is when receipt was confirmed, where the recipient does so
	acknowledged?: gemara.#Datetime

	// outcome records any response, such as a follow-up request or a finding
	outcome?: string

	// evidence is the report as submitted
	evidence?: [iso.#Evidence, ...iso.#Evidence]
}
