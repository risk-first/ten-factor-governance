// SPDX-License-Identifier: Apache-2.0

// Schema lifecycle: experimental | stable | deprecated
@status("experimental")

// Package iso defines the management-system artifacts an ISO standard requires
// that Gemara does not already model.
//
// Gemara types the governance itself — principles, guidance, controls, threats,
// risks, policy and the logs an activity produces. ISO/IEC 27001 and
// ISO/IEC 42001 wrap that in a management system: context, scope, interested
// parties, objectives, applicability decisions, competence, communication,
// review, corrective action. The artifacts here are that envelope, in the form
// both standards ask for it. Anything one standard alone requires belongs in a
// standard-specific package.
//
// These artifacts follow Gemara document conventions so that a Governance Twin
// can hold them alongside Gemara catalogs: a title, a metadata block, optional
// groups, and entries carrying stable ids that other artifacts reference.
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// ArtifactType identifies the kind of ISO management-system artifact for
// unambiguous parsing. It covers this package and the standard-specific
// packages that build on it, so one parser can read a whole management system.
#ArtifactType: "OrganisationContext" |
	"GovernanceScope" |
	"PartyRegister" |
	"StakeholderRequirementCatalog" |
	"ManagementObjectiveCatalog" |
	"ApplicabilityProfile" |
	"RiskAssessment" |
	"CompetenceRegister" |
	"CommunicationPlan" |
	"ManagementReview" |
	"CorrectiveActionLog" |
	"IncidentLog" |
	"AISystemRegister" |
	"DatasetRegister" |
	"ToolResourceRegister" |
	"ImpactAssessment" |
	"SupplierAssuranceRegister" |
	"GovernanceContractRegister" |
	"AuditProgramme" |
	"ReportingObligationRegister"

// Metadata carries the same fields as gemara.#Metadata for artifact types
// Gemara does not define, plus the records-management fields Clause 7.5 asks
// for: who approved this version, when it takes effect and how long it is kept.
#Metadata: {
	// id allows this artifact to be referenced by other elements
	id: string

	// type identifies the kind of artifact for unambiguous parsing
	type: #ArtifactType

	// gemara-version declares which version of the Gemara specification the
	// document conventions and embedded Gemara types conform to
	"gemara-version": string

	// version is the version identifier of this artifact
	version?: string

	// date is the publication or effective date of this artifact
	date?: gemara.#Datetime

	// description provides a high-level summary of the artifact's purpose and scope
	description: string

	// author is the person or group primarily responsible for this artifact
	author: gemara.#Actor

	// standard names the management-system standard this artifact serves,
	// e.g. "ISO/IEC 42001:2023"
	standard?: string

	// mapping-references lists external documents referenced within this artifact
	MR="mapping-references"?: [gemara.#MappingReference, ...gemara.#MappingReference]

	// applicability-groups classifies scope within this artifact
	AG="applicability-groups"?: [gemara.#Group, ...gemara.#Group]

	// draft indicates whether this artifact is a pre-release version
	draft?: bool

	// approval records who signed this version off and when it takes effect
	approval?: #Approval

	// retention states how long this artifact is kept and what happens after
	retention?: #Retention

	if MR != _|_ {
		_uniqueRefIds: {for i, r in MR {(r.id): i}}
	}
	if AG != _|_ {
		_uniqueGroupsIds: {for i, g in AG {(g.id): i}}
	}
}

// Document is the shape every artifact in this package shares, mirroring
// gemara.#Catalog so the two families can sit in the same twin.
#Document: {
	// title describes the purpose of this document at a glance
	title: string

	// metadata provides detailed data about this document
	metadata: #Metadata

	// groups contains groups that entries in this document may reference
	groups?: [gemara.#Group, ...gemara.#Group]

	// extends references documents this one builds upon
	extends?: [...gemara.#ArtifactMapping]

	// clauses records which clauses of the standard this document answers,
	// e.g. "4.1" or "A.5.2"
	clauses?: [string, ...string]

	if groups != _|_ {
		_uniqueGroupIds: {for i, g in groups {(g.id): i}}
	}
}

// Approval records the sign-off ISO expects on documented information
#Approval: {
	// approved-by is the person or body that approved this version
	"approved-by": gemara.#Contact

	// date is when approval was given
	date: gemara.#Datetime

	// effective-date is when the approved content takes effect, if later
	"effective-date"?: gemara.#Datetime

	// supersedes is the version identifier this one replaces
	supersedes?: string
}

// Retention states how long documented information is kept and what follows
#Retention: {
	// period is the retention period, e.g. "7 years from closure"
	period: string

	// disposition is what happens at the end of the period
	disposition?: "Delete" | "Archive" | "Anonymise" | "Review"

	// classification is the access classification governing the artifact
	classification?: string
}

// Review records how often something is looked at again, and what forces an
// early look. ISO asks for this on most management-system artifacts.
#Review: {
	// cadence is the planned review interval
	cadence: #Cadence

	// last-reviewed is when the most recent review completed
	"last-reviewed"?: gemara.#Datetime

	// next-review is when the next review is due
	"next-review"?: gemara.#Datetime

	// triggers are changes that force a review before the cadence falls due
	triggers?: [string, ...string]

	// reviewer is who performs the review
	reviewer?: gemara.#Contact
}

// Cadence is a planned interval for a review, measurement or communication
#Cadence: "Continuous" |
	"Daily" |
	"Weekly" |
	"Monthly" |
	"Quarterly" |
	"Biannual" |
	"Annual" |
	"Biennial" |
	"Event-driven" |
	"Ad hoc"

// Period is a bounded window of time, such as a measurement or review period
#Period: {
	start: gemara.#Datetime
	end?:  gemara.#Datetime
}

// Reference points at an entry in another artifact, Gemara or ISO. The
// referenced document is declared in metadata.mapping-references.
#Reference: gemara.#EntryMapping

// Evidence points at the material that substantiates a claim
#Evidence: gemara.#EvidenceMapping

// Severity reuses the Gemara scale so ISO assessments and Gemara risk
// catalogs rate consequence the same way
#Severity: gemara.#Severity

// Likelihood is the assessed chance of something occurring
#Likelihood: "Rare" | "Unlikely" | "Possible" | "Likely" | "Almost Certain"

// ActionStatus tracks work an artifact commits somebody to
#ActionStatus: "Open" | "In Progress" | "Blocked" | "Complete" | "Cancelled"

// Action is a piece of work with an owner and a deadline. Reviews, audits,
// incidents and corrective actions all raise these.
#Action: {
	// id allows this action to be referenced by other elements
	id: string

	// description states what will be done
	description: string

	// owner is accountable for the action being completed
	owner: gemara.#Contact

	// due is when the action is expected to be complete
	due?: gemara.#Datetime

	// status is where the action has got to
	status: #ActionStatus

	// completed is when the action was actually finished
	completed?: gemara.#Datetime

	// evidence substantiates completion
	evidence?: [#Evidence, ...#Evidence]
}
