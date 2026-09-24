// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// GovernanceScope is the documented boundary of the management system: what it
// covers, what it deliberately does not, and the interfaces across that line.
//
// ISO/IEC 42001 Clause 4.3 (AIMS scope), ISO/IEC 27001 Clause 4.3 (ISMS scope).
// Gemara scopes an individual sensitive activity well and the management system
// around it not at all.
#GovernanceScope: {
	#Document
	metadata: type: "GovernanceScope"

	// statement is the scope as it would be published, in prose
	statement: string

	// inclusions are the things inside the boundary
	inclusions: [#ScopeItem, ...#ScopeItem]

	// exclusions are the things deliberately outside it. ISO expects the
	// reasoning, not just the fact.
	exclusions?: [#ScopeExclusion, ...#ScopeExclusion]

	// interfaces are the dependencies and hand-offs that cross the boundary,
	// where responsibility passes to somebody else
	interfaces?: [#ScopeInterface, ...#ScopeInterface]

	// context is the OrganisationContext this scope was drawn against
	context?: #Reference

	// requirements are the stakeholder requirements considered when drawing it
	requirements?: [#Reference, ...#Reference]

	// review states how often the scope is revisited
	review?: #Review

	_uniqueInclusionIds: {for i, s in inclusions {(s.id): i}}
	if exclusions != _|_ {
		_uniqueExclusionIds: {for i, s in exclusions {(s.id): i}}
	}
	if interfaces != _|_ {
		_uniqueInterfaceIds: {for i, s in interfaces {(s.id): i}}
	}
}

// ScopeItemType is the kind of thing a scope statement names
#ScopeItemType: "Organisation" |
	"Business Unit" |
	"Site" |
	"Activity" |
	"System" |
	"Service" |
	"Dataset" |
	"Process" |
	"Supplier"

// ScopeItem is one thing inside the management system boundary
#ScopeItem: {
	// id allows this item to be referenced by other elements
	id: string

	// name is what the item is called
	name: string

	// type is the kind of thing being scoped in
	type: #ScopeItemType

	// description explains what it covers
	description?: string

	// owner is accountable for the item
	owner?: gemara.#Contact

	// target references the item in the register that holds it, such as an
	// AI system register entry or a Gemara sensitive activity
	target?: #Reference
}

// ScopeExclusion is something outside the boundary, with the reasoning ISO
// expects for leaving it out
#ScopeExclusion: {
	// id allows this exclusion to be referenced by other elements
	id: string

	// name is what is being excluded
	name: string

	// type is the kind of thing being excluded
	type: #ScopeItemType

	// justification explains why it is out of scope
	justification: string

	// governed-elsewhere names the management system or owner that does cover
	// it, where the exclusion is a division of labour rather than a gap
	"governed-elsewhere"?: string
}

// ScopeInterface is a dependency or hand-off crossing the scope boundary
#ScopeInterface: {
	// id allows this interface to be referenced by other elements
	id: string

	// description states what passes across the boundary
	description: string

	// direction states which way the dependency runs
	direction: "Inbound" | "Outbound" | "Bidirectional"

	// counterparty is the party on the other side
	counterparty?: #Reference

	// responsibilities records who is responsible for what across the
	// interface, typically a governance contract entry
	responsibilities?: #Reference
}
