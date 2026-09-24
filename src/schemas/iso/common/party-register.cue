// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import (
	"list"

	"github.com/gemaraproj/gemara@v1:gemara"
)

// PartyRegister is the one place people and organisations are named, whatever
// their relationship to the governed activity: interested in it, affected by
// it, accountable for it, or contractually bound to it.
//
// ISO/IEC 42001 Clauses 4.2, 5.1, 5.3 and Annex A.3.2 and A.5.4;
// ISO/IEC 27001 Clauses 4.2 and 5.3. Gemara's RACI names the parties around a
// single artifact; this register is the roll they are drawn from, so an
// interested party, an accountable owner and an affected group are one model
// with different roles rather than three schemas.
#PartyRegister: {
	#Document
	metadata: type: "PartyRegister"

	// parties are the people, groups and organisations on the register
	parties: [#Party, ...#Party]

	// review states how often the register is revisited
	review?: #Review

	_uniquePartyIds: {for i, p in parties {(p.id): i}}

	// representation must point at another party on this register
	let _partyIds = [for p in parties {p.id}]
	for i, p in parties if p."represented-by" != _|_ {
		_representationValidation: "\(i)": _partyIds & list.Contains(p."represented-by")
	}
}

// PartyKind distinguishes what sort of party is being registered, which
// determines what can meaningfully be said about it
#PartyKind: "Individual" |
	"Group" |
	"Team" |
	"Organisation" |
	"Regulator" |
	"Customer" |
	"Supplier" |
	"Community" |
	"Public"

// PartyRole is the relationship a party has to the governed activity. A party
// may hold several: a regulator is interested, a data subject is affected, a
// product owner is accountable.
#PartyRole:
	// interested parties place requirements on the management system (Clause 4.2)
	"Interested" |
	// affected parties bear the consequences of the activity, whether or not
	// they interact with it (ISO/IEC 42001 Annex A.5.4)
	"Affected" |
	// accountable parties answer for the outcome and can change the governance
	"Accountable" |
	// responsible parties do the work
	"Responsible" |
	// consulted parties must be asked before decisions are taken
	"Consulted" |
	// informed parties must be told after them
	"Informed" |
	// approvers sign off documented information and governance changes
	"Approver" |
	// escalation parties are reached when something goes wrong
	"Escalation" |
	// top management carries the leadership duties ISO places on it (Clause 5.1)
	"Top Management"

// Party is a single entry on the register
#Party: {
	// id allows this party to be referenced by other elements
	id: string

	// name is what the party is called
	name: string

	// kind is what sort of party this is
	kind: #PartyKind

	// roles are the relationships this party has to the governed activity
	roles: [#PartyRole, ...#PartyRole]

	// internal distinguishes parties inside the organisation from outside it
	internal?: bool

	// description explains who they are and why they are on the register
	description?: string

	// contact is how the party is reached, where a contact point exists.
	// Affected groups and the public often have none, which is the point of
	// recording them separately.
	contact?: gemara.#Contact

	// group references a group declared by this document
	group?: string

	// authority states what this party is empowered to decide, for the roles
	// that carry decision rights (Clause 5.3)
	authority?: string

	// escalation is how and when this party is escalated to
	escalation?: #Escalation

	// represented-by names another party on this register that speaks for this
	// one, such as a works council for staff or an advocacy body for a
	// community that cannot be contacted directly
	"represented-by"?: string

	// requirements are the stakeholder requirements this party places
	requirements?: [#Reference, ...#Reference]
}

// Escalation states how a party is reached when something goes wrong
#Escalation: {
	// trigger is what causes escalation to this party
	trigger: string

	// channel is how they are reached
	channel?: string

	// within is the time within which they must be reached
	within?: string
}
