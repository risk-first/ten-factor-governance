// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// SupplierAssuranceRegister records what the organisation relies on suppliers
// for, what they have committed to, and what evidence backs the commitment.
//
// ISO/IEC 42001 Annex A.10.3 (suppliers), read with A.10.2 (allocating
// responsibilities). Governance is composable, so an organisation inherits
// governance from the suppliers of its models, data and services; what it
// cannot inherit is the accountability. This register is where that split is
// written down and where inherited claims are made checkable rather than
// assumed.
#SupplierAssuranceRegister: {
	iso.#Document
	metadata: type: "SupplierAssuranceRegister"

	// suppliers are the external parties the AI systems depend on
	suppliers: [#SupplierAssurance, ...#SupplierAssurance]

	// review states how often the register is revisited
	review?: iso.#Review

	_uniqueSupplierIds: {for i, s in suppliers {(s.id): i}}
}

// SupplierAssurance is what one supplier provides and what backs it
#SupplierAssurance: {
	// id allows this entry to be referenced by other elements
	id: string

	// party references the supplier on the party register
	party: iso.#Reference

	// provides states what the organisation depends on them for
	provides: [#SupplierProvision, ...#SupplierProvision]

	// criticality is how much the management system depends on them, which
	// determines how much assurance is proportionate
	criticality: iso.#Severity

	// obligations are what the supplier has committed to
	obligations?: [#SupplierObligation, ...#SupplierObligation]

	// contract references the governance contract allocating responsibility
	contract?: iso.#Reference

	// attestations are the evidence the supplier offers for its commitments
	attestations?: [#Attestation, ...#Attestation]

	// inherited-governance are the supplier's own published governance
	// artifacts the organisation imports rather than restates
	"inherited-governance"?: [iso.#Reference, ...iso.#Reference]

	// risks are the risks arising from the dependency
	risks?: [iso.#Reference, ...iso.#Reference]

	// controls are the controls the organisation applies to manage it,
	// as distinct from the ones the supplier operates
	controls?: [iso.#Reference, ...iso.#Reference]

	// exit describes what happens if the supplier fails or is dropped, which
	// is the residual question for a critical dependency
	exit?: string

	// review states how often the supplier is reassessed
	review?: iso.#Review

	// status is the standing of the relationship
	status: "Proposed" | "Approved" | "Approved With Conditions" | "Suspended" | "Terminated"

	// group references a group declared by this document
	group?: string
}

// SupplierProvision is one thing a supplier provides
#SupplierProvision: {
	// type is the kind of thing provided
	type: "Model" |
		"AI Service" |
		"Data" |
		"Tooling" |
		"Infrastructure" |
		"Development" |
		"Evaluation" |
		"Operations"

	// description explains what is provided
	description: string

	// resources are the register entries this provision corresponds to
	resources?: [iso.#Reference, ...iso.#Reference]
}

// SupplierObligation is a commitment a supplier has made
#SupplierObligation: {
	// id allows this obligation to be referenced by other elements
	id: string

	// statement is what the supplier has committed to
	statement: string

	// source names where the commitment is recorded, such as a contract
	// clause or a published policy
	source?: string

	// controls are the controls this obligation is expected to satisfy
	controls?: [iso.#Reference, ...iso.#Reference]

	// verification states how the organisation checks the commitment is met,
	// rather than taking it on trust
	verification?: string

	// status is whether it is being met
	status?: "Met" | "Not Met" | "Unverified" | "Waived"
}

// Attestation is evidence a supplier offers for a commitment
#Attestation: {
	// id allows this attestation to be referenced by other elements
	id: string

	// type is the kind of assurance offered
	type: "Certification" |
		"Audit Report" |
		"Self-assessment" |
		"Test Result" |
		"Contractual Warranty" |
		"Model Card" |
		"Provenance Attestation"

	// title names the attestation
	title: string

	// issuer is who produced it, which is the difference between an audit and
	// a self-assessment
	issuer?: string

	// scope states what it actually covers, which is frequently narrower than
	// what is relied on
	scope?: string

	// issued is when it was produced
	issued?: gemara.#Datetime

	// expires is when it lapses
	expires?: gemara.#Datetime

	// evidence points at the attestation itself
	evidence?: [iso.#Evidence, ...iso.#Evidence]
}
