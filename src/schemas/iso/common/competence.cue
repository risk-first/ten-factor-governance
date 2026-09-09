// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// CompetenceRegister records what people need to be able to do for the
// management system to work, and the evidence that they can.
//
// ISO/IEC 42001 and ISO/IEC 27001 Clause 7.2, with awareness under Clause 7.3.
// Gemara names owners; it says nothing about whether an owner is equipped to
// do the job, which is the whole of Clause 7.2.
#CompetenceRegister: {
	#Document
	metadata: type: "CompetenceRegister"

	// requirements are the competences the management system depends on
	requirements: [#CompetenceRequirement, ...#CompetenceRequirement]

	// records are the evidence that named parties hold them
	records?: [#CompetenceRecord, ...#CompetenceRecord]

	// awareness are the things personnel must understand, as distinct from
	// the competences they must have (Clause 7.3)
	awareness?: [#AwarenessRequirement, ...#AwarenessRequirement]

	// review states how often the register is revisited
	review?: #Review

	_uniqueRequirementIds: {for i, r in requirements {(r.id): i}}
	if records != _|_ {
		_uniqueRecordIds: {for i, r in records {(r.id): i}}
	}
	if awareness != _|_ {
		_uniqueAwarenessIds: {for i, a in awareness {(a.id): i}}
	}
}

// CompetenceRequirement is something a role must be able to do
#CompetenceRequirement: {
	// id allows this requirement to be referenced by other elements
	id: string

	// title describes the competence at a glance
	title: string

	// description explains what someone holding it can do
	description: string

	// role is the party-register role the requirement attaches to
	role?: #Reference

	// applies-to are the activities, systems or artifacts whose governance
	// depends on this competence
	"applies-to"?: [#Reference, ...#Reference]

	// basis is how the competence may be established
	basis?: [#CompetenceBasis, ...#CompetenceBasis]

	// revalidation is how often the competence must be demonstrated again
	revalidation?: #Cadence

	// group references a group declared by this document
	group?: string
}

// CompetenceBasis is a way of establishing competence
#CompetenceBasis: "Education" | "Training" | "Experience" | "Certification" | "Assessment"

// CompetenceRecord is evidence that a party holds a required competence
#CompetenceRecord: {
	// id allows this record to be referenced by other elements
	id: string

	// party references the person on the party register
	party: #Reference

	// requirement references the competence requirement being satisfied
	requirement: string

	// basis is how it was established
	basis: #CompetenceBasis

	// description gives the detail: the course, the qualification, the years
	description?: string

	// achieved is when the competence was established
	achieved: gemara.#Datetime

	// expires is when it lapses, for competences that do
	expires?: gemara.#Datetime

	// evidence substantiates the record
	evidence?: [#Evidence, ...#Evidence]
}

// AwarenessRequirement is something personnel must understand, whether or not
// they are competent to act on it
#AwarenessRequirement: {
	// id allows this requirement to be referenced by other elements
	id: string

	// subject is what people must be aware of, such as the policy, their
	// contribution to the management system, or the consequences of
	// nonconformity
	subject: string

	// audience are the parties who must be aware
	audience: [#Reference, ...#Reference]

	// method is how awareness is created and refreshed
	method?: string

	// frequency is how often it is refreshed
	frequency?: #Cadence

	// attestation states whether personnel must confirm awareness, and how
	attestation?: string

	// evidence substantiates that awareness was achieved
	evidence?: [#Evidence, ...#Evidence]
}
