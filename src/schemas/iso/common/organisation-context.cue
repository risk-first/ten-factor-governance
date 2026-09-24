// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// OrganisationContext records the internal and external issues relevant to the
// organisation's purpose and its ability to achieve the intended outcomes of
// the management system.
//
// ISO/IEC 42001 Clause 4.1, ISO/IEC 27001 Clause 4.1. Gemara has no equivalent:
// a twin can consume context, but the exercise of establishing it is not
// recorded anywhere.
#OrganisationContext: {
	#Document
	metadata: type: "OrganisationContext"

	// purpose states what the organisation is for, as the issues below are
	// only relevant relative to it
	purpose: string

	// issues are the internal and external matters bearing on the management
	// system's ability to achieve its intended outcomes
	issues?: [#ContextIssue, ...#ContextIssue]

	// jurisdictions are the legal and regulatory regimes the organisation
	// operates under, which drive obligations in the requirement catalog
	jurisdictions?: [string, ...string]

	// boundaries describe the organisational units, sites and legal entities
	// the context covers, ahead of the narrower management-system scope
	boundaries?: [#OrganisationalBoundary, ...#OrganisationalBoundary]

	// review states how often the context is revisited and what forces it
	review?: #Review

	if issues != _|_ {
		_uniqueIssueIds: {for i, e in issues {(e.id): i}}
	}
	if boundaries != _|_ {
		_uniqueBoundaryIds: {for i, b in boundaries {(b.id): i}}
	}
}

// ContextIssue is a single internal or external matter affecting the
// management system
#ContextIssue: {
	// id allows this issue to be referenced by other elements
	id: string

	// title describes the issue at a glance
	title: string

	// origin distinguishes issues the organisation controls from those it does not
	origin: "Internal" | "External"

	// category groups issues so trends can be read across them
	category?: "Legal" |
		"Regulatory" |
		"Technological" |
		"Competitive" |
		"Market" |
		"Cultural" |
		"Social" |
		"Economic" |
		"Environmental" |
		"Organisational" |
		"Contractual"

	// description explains the issue and why it bears on the management system
	description: string

	// effect states how the issue helps or hinders the intended outcomes
	effect?: "Opportunity" | "Threat" | "Both"

	// group references a group declared by this document
	group?: string

	// parties are the interested parties this issue arises from or affects
	parties?: [#Reference, ...#Reference]

	// risks are risks in a Gemara RiskCatalog that this issue gives rise to
	risks?: [#Reference, ...#Reference]

	// identified is when the issue was first recorded
	identified?: gemara.#Datetime
}

// OrganisationalBoundary is a unit, site or entity the context covers
#OrganisationalBoundary: {
	// id allows this boundary to be referenced by other elements
	id: string

	// name is what the unit, site or entity is called
	name: string

	// type distinguishes the kind of boundary being drawn
	type: "Legal Entity" | "Business Unit" | "Site" | "Function" | "Jurisdiction"

	// description explains what falls inside it
	description?: string

	// owner is accountable for this part of the organisation
	owner?: gemara.#Contact
}
