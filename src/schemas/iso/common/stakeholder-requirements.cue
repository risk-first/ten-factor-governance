// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// StakeholderRequirementCatalog holds what interested parties require of the
// management system, as objects rather than prose, so that guidance, controls
// and policy can be traced back to whoever demanded them.
//
// ISO/IEC 42001 and ISO/IEC 27001 Clause 4.2. ISO/IEC 27001 calls these
// obligations. Gemara can express the resulting control; it cannot express the
// regulator, customer or law that asked for it.
#StakeholderRequirementCatalog: {
	#Document
	metadata: type: "StakeholderRequirementCatalog"

	// requirements are the demands placed on the management system
	requirements: [#StakeholderRequirement, ...#StakeholderRequirement]

	// review states how often the catalog is revisited
	review?: #Review

	_uniqueRequirementIds: {for i, r in requirements {(r.id): i}}
}

// RequirementSource is where a requirement comes from, which determines how
// much discretion the organisation has about meeting it
#RequirementSource: "Legal" |
	"Regulatory" |
	"Contractual" |
	"Customer" |
	"Organisational" |
	"Societal" |
	"Standard" |
	"Ethical"

// ObligationLevel is how binding the requirement is
#ObligationLevel: "Mandatory" | "Expected" | "Desired"

// StakeholderRequirement is one thing an interested party requires
#StakeholderRequirement: {
	// id allows this requirement to be referenced by other elements
	id: string

	// title describes the requirement at a glance
	title: string

	// statement is what is actually required, in the terms the party expressed it
	statement: string

	// source is where the requirement comes from
	source: #RequirementSource

	// level is how binding it is
	level: #ObligationLevel

	// party references the party on the register that places this requirement
	party: #Reference

	// authority names the law, regulation, contract or standard the
	// requirement derives from, with the clause where possible
	authority?: string

	// jurisdiction is where the requirement applies, for legal and regulatory
	// sources that do not apply everywhere the organisation operates
	jurisdiction?: string

	// group references a group declared by this document
	group?: string

	// in-scope records whether the management system has taken this
	// requirement on. ISO asks which interested-party requirements are
	// relevant, so recording the ones considered and set aside matters as much
	// as the ones adopted.
	IS="in-scope": bool

	// rationale explains an in-scope decision, and is required when a
	// requirement is set aside
	rationale?: string

	if !IS {
		rationale!: string
	}

	// guidance are the guidance entries that interpret this requirement
	guidance?: [#Reference, ...#Reference]

	// controls are the controls that satisfy it
	controls?: [#Reference, ...#Reference]

	// risks are the risks of failing to meet it
	risks?: [#Reference, ...#Reference]

	// policies are the policies that carry it into effect
	policies?: [#Reference, ...#Reference]

	// objectives are the management objectives measuring whether it is met
	objectives?: [#Reference, ...#Reference]

	// evidence substantiates that the requirement is being met
	evidence?: [#Evidence, ...#Evidence]

	// identified is when the requirement was recorded
	identified?: gemara.#Datetime
}
