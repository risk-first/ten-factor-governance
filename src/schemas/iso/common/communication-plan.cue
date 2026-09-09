// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// CommunicationPlan records what the management system must communicate, to
// whom, when and how.
//
// ISO/IEC 42001 and ISO/IEC 27001 Clause 7.4; ISO/IEC 42001 Annex A.8.5 adds
// information for interested parties. Gemara notifies well when something goes
// wrong — enforcement and escalation — and has nothing for the routine
// communication ISO expects to be planned in advance.
#CommunicationPlan: {
	#Document
	metadata: type: "CommunicationPlan"

	// requirements are the communications that must happen
	requirements: [#CommunicationRequirement, ...#CommunicationRequirement]

	// review states how often the plan is revisited
	review?: #Review

	_uniqueRequirementIds: {for i, r in requirements {(r.id): i}}
}

// CommunicationRequirement is one thing that must be communicated
#CommunicationRequirement: {
	// id allows this requirement to be referenced by other elements
	id: string

	// subject is what is communicated
	subject: string

	// content states what the communication must contain to be adequate
	content?: string

	// audience are the parties who must receive it
	audience: [#Reference, ...#Reference]

	// direction distinguishes what the organisation puts out from what it
	// must be able to receive, such as reported concerns
	direction: *"Outbound" | "Inbound" | "Bidirectional"

	// trigger is what causes the communication
	trigger: #CommunicationTrigger

	// channel is how it is delivered
	channel: string

	// owner is accountable for it happening
	owner: gemara.#Contact

	// group references a group declared by this document
	group?: string

	// requirements are the stakeholder requirements this communication
	// discharges, such as a regulator's notification duty
	requirements?: [#Reference, ...#Reference]

	// language records the languages the communication must be available in,
	// where affected parties do not share one
	language?: [string, ...string]

	// records are the communications actually sent
	records?: [#CommunicationRecord, ...#CommunicationRecord]
}

// CommunicationTrigger is what causes a communication to be due
#CommunicationTrigger: {
	// type distinguishes scheduled communication from event-driven
	type: "Scheduled" | "Event" | "On Request"

	// cadence is the schedule, for scheduled communication
	cadence?: #Cadence

	// event is what must happen, for event-driven communication
	event?: string

	// within is the deadline measured from the event
	within?: string

	if type == "Scheduled" {
		cadence!: #Cadence
	}
	if type == "Event" {
		event!: string
	}
}

// CommunicationRecord is evidence that a required communication happened
#CommunicationRecord: {
	// sent is when it went out
	sent: gemara.#Datetime

	// audience is who actually received it, where that differs from the plan
	audience?: [#Reference, ...#Reference]

	// summary is what was said
	summary?: string

	// evidence substantiates the communication
	evidence?: [#Evidence, ...#Evidence]
}
