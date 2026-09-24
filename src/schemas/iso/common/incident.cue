// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// IncidentLog records things that went wrong in operation: what happened, who
// was affected, who was told and what followed.
//
// ISO/IEC 42001 Annex A.8.4 (communication of AI incidents); ISO/IEC 27001
// Annex A.5.24–A.5.28. Gemara evidence makes an incident reconstructable after
// the fact; ISO wants the incident itself to be an object with a lifecycle,
// because notification duties and corrective action hang off it.
#IncidentLog: {
	#Document
	metadata: type: "IncidentLog"

	// entries are the incidents recorded
	entries: [#Incident, ...#Incident]

	_uniqueEntryIds: {for i, e in entries {(e.id): i}}
}

// IncidentStatus is where handling has got to
#IncidentStatus: "Detected" |
	"Triaged" |
	"Contained" |
	"Resolved" |
	"Closed" |
	"False Positive"

// Incident is one thing that went wrong
#Incident: {
	// id allows this incident to be referenced by other elements
	id: string

	// title describes the incident at a glance
	title: string

	// description states what happened
	description: string

	// category groups incidents so patterns can be read across them
	category?: string

	// severity is how serious it was
	severity: #Severity

	// status is where handling has got to
	status: #IncidentStatus

	// detected is when it was noticed
	detected: gemara.#Datetime

	// occurred is when it actually began, where that is known and differs
	occurred?: gemara.#Datetime

	// resolved is when normal operation was restored
	resolved?: gemara.#Datetime

	// owner is accountable for handling it
	owner: gemara.#Contact

	// affected-systems are the systems, activities or resources involved
	"affected-systems"?: [#Reference, ...#Reference]

	// affected-parties are the parties who bore consequences. For AI
	// incidents these are frequently people outside the organisation, which
	// is why they are named rather than counted.
	"affected-parties"?: [#Reference, ...#Reference]

	// risks are the risks that materialised
	risks?: [#Reference, ...#Reference]

	// controls are the controls that failed or held
	controls?: [#Reference, ...#Reference]

	// communications are the notifications made about this incident, and the
	// ones still owed
	communications?: [#IncidentCommunication, ...#IncidentCommunication]

	// nonconformities are the entries raised in the corrective action log
	nonconformities?: [#Reference, ...#Reference]

	// evidence substantiates what happened
	evidence?: [#Evidence, ...#Evidence]
}

// IncidentCommunication is one notification about an incident. Regulatory
// notification deadlines make the difference between due and sent material.
#IncidentCommunication: {
	// id allows this communication to be referenced by other elements
	id: string

	// audience is who is being told
	audience: #Reference

	// requirement is the communication requirement or obligation being
	// discharged
	requirement?: #Reference

	// due is when the notification must be made by
	due?: gemara.#Datetime

	// sent is when it was actually made
	sent?: gemara.#Datetime

	// channel is how it was delivered
	channel?: string

	// summary is what was said
	summary?: string

	// status is whether the notification has been made
	status: "Owed" | "Sent" | "Acknowledged" | "Not Required"

	// evidence substantiates it
	evidence?: [#Evidence, ...#Evidence]

	if status == "Sent" || status == "Acknowledged" {
		sent!: gemara.#Datetime
	}
}
