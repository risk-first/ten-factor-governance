// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// GovernanceContractRegister records how governance responsibility is divided
// between the organisation and the parties it builds with, buys from and sells
// to.
//
// ISO/IEC 42001 Annex A.10.2 (allocating responsibilities) and A.10.4
// (customers). Where the supplier register looks at what the organisation
// relies on, this looks at who is answerable for what across a boundary — in
// both directions, since the organisation is somebody else's supplier. The
// failure this prevents is the responsibility that each side believes the
// other holds.
#GovernanceContractRegister: {
	iso.#Document
	metadata: type: "GovernanceContractRegister"

	// contracts are the responsibility allocations in force
	contracts: [#GovernanceContract, ...#GovernanceContract]

	// review states how often the register is revisited
	review?: iso.#Review

	_uniqueContractIds: {for i, c in contracts {(c.id): i}}
}

// GovernanceContract is one allocation of responsibility across an
// organisational boundary
#GovernanceContract: {
	// id allows this contract to be referenced by other elements
	id: string

	// title names the arrangement
	title: string

	// counterparty references the other party on the party register
	counterparty: iso.#Reference

	// relationship is the organisation's position in the arrangement
	relationship: "Provider" | "Customer" | "Supplier" | "Partner" | "Processor" | "Controller"

	// subject is what the arrangement covers: a system, a service, a dataset,
	// an activity
	subject: [iso.#Reference, ...iso.#Reference]

	// instrument names the contract, agreement or terms the allocation rests
	// on, so a governance record can be traced to a legal one
	instrument?: string

	// allocations are the responsibilities and who holds each
	allocations: [#ResponsibilityAllocation, ...#ResponsibilityAllocation]

	// shared-responsibilities are the duties neither party holds alone, which
	// need naming precisely because they are where things fall through
	"shared-responsibilities"?: [#ResponsibilityAllocation, ...#ResponsibilityAllocation]

	// information-provided is what the organisation must tell the
	// counterparty for them to discharge their side, such as the limitations
	// and intended use of a system supplied to a customer
	"information-provided"?: [iso.#Reference, ...iso.#Reference]

	// period is how long the arrangement runs for
	period?: iso.#Period

	// status is the standing of the arrangement
	status: "Draft" | "Active" | "Expired" | "Terminated"

	// review states how often the allocation is revisited
	review?: iso.#Review

	// group references a group declared by this document
	group?: string

	_uniqueAllocationIds: {for i, a in allocations {(a.id): i}}
}

// ResponsibilityAllocation is one duty and the party that holds it
#ResponsibilityAllocation: {
	// id allows this allocation to be referenced by other elements
	id: string

	// responsibility states the duty being allocated
	responsibility: string

	// holder is who holds it
	holder: "Organisation" | "Counterparty" | "Shared"

	// lifecycle-stage narrows the duty to a stage, where responsibility
	// changes hands as a system moves through its life
	"lifecycle-stage"?: #AILifecycleStage

	// controls are the controls that discharge the duty
	controls?: [iso.#Reference, ...iso.#Reference]

	// obligations are the stakeholder requirements this allocation answers
	obligations?: [iso.#Reference, ...iso.#Reference]

	// evidence is what either side must produce to show the duty is met.
	// An allocation without expected evidence is an intention, not a control.
	evidence?: [iso.#Evidence, ...iso.#Evidence]

	// escalation is what happens when the holder does not discharge it
	escalation?: string

	// verified is when the organisation last checked the duty is being met
	verified?: gemara.#Datetime
}
