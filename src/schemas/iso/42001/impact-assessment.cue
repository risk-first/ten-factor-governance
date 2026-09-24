// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// ImpactAssessment records the consequences an AI system can have for
// individuals, groups and society, and what is being done about them.
//
// ISO/IEC 42001 Clauses 6.1.4 and 8.4 and Annex A.5.2–A.5.5, with the process
// elaborated by ISO/IEC 42005. This is the largest AI-specific gap in the
// catalogue: a risk assessment asks what could go wrong for the organisation,
// and an impact assessment asks what could go wrong for everybody else. The
// two are related but not interchangeable, which is why impacts are rated
// here and then fed into risk assessment rather than collapsed into it.
//
// The distinctive fields are the ones a risk model does not have: who is
// affected as opposed to who is exposed, whether the harm falls unevenly on
// particular groups, and whether it can be undone.
#ImpactAssessment: {
	iso.#Document
	metadata: type: "ImpactAssessment"

	// system is the AI system being assessed
	system: iso.#Reference

	// system-version pins the version assessed, since impact conclusions do
	// not survive arbitrary change to the system
	"system-version"?: string

	// purpose-assessed is the intended use the assessment was made against.
	// An assessment is only valid for the purpose it considered.
	"purpose-assessed": string

	// deployment-context describes where and how the system is used, since
	// the same model has different consequences in different settings
	"deployment-context": string

	// assessor is who performed the assessment
	assessor: gemara.#Actor

	// date is when it was performed
	date: gemara.#Datetime

	// trigger is why this assessment was run
	trigger: "Initial" | "Planned" | "Change" | "Incident" | "Review" | "Ad hoc"

	// methodology names the process followed, e.g. "ISO/IEC 42005"
	methodology?: string

	// consultation records whether affected parties were asked, and what they
	// said. Assessing impact on people without consulting them is a known
	// failure mode, so the absence is recorded rather than left implicit.
	consultation?: [#Consultation, ...#Consultation]

	// impacts are the consequences identified
	impacts: [#Impact, ...#Impact]

	// conclusion is the overall judgement, including whether the system
	// should proceed
	conclusion: #ImpactConclusion

	// risks are the risk-catalog entries these impacts give rise to, which is
	// how the assessment feeds risk treatment as Clause 6.1.4 requires
	risks?: [iso.#Reference, ...iso.#Reference]

	// review states when the assessment must be repeated and what forces it
	// early, which is what Clause 8.4 asks for
	review?: iso.#Review

	// evidence substantiates the assessment
	evidence?: [iso.#Evidence, ...iso.#Evidence]

	_uniqueImpactIds: {for i, im in impacts {(im.id): i}}
}

// ImpactCategory is the kind of consequence, which determines who needs to be
// consulted and what would count as mitigation
#ImpactCategory: "Physical Safety" |
	"Health" |
	"Fundamental Rights" |
	"Privacy" |
	"Fairness and Discrimination" |
	"Economic" |
	"Access to Services" |
	"Autonomy" |
	"Psychological" |
	"Reputational" |
	"Environmental" |
	"Societal" |
	"Democratic and Civic" |
	"Cultural"

// Reversibility is whether the harm can be undone, which matters more for
// impact than for risk: an irreversible harm to a person is not offset by a
// low likelihood in the way a financial loss might be
#Reversibility: "Reversible" | "Partially Reversible" | "Irreversible" | "Unknown"

// Impact is one consequence the system can have
#Impact: {
	// id allows this impact to be referenced by other elements
	id: string

	// title describes the impact at a glance
	title: string

	// description explains the consequence and how it comes about
	description: string

	// category is the kind of consequence
	category: #ImpactCategory

	// affected are the parties who bear it, referenced on the party register
	affected: [iso.#Reference, ...iso.#Reference]

	// differentiated records whether the impact falls more heavily on
	// particular groups, which Annex A.5.4 requires to be considered
	differentiated?: #DifferentiatedImpact

	// severity is how serious the consequence is for those affected. Rated
	// from their point of view, not the organisation's.
	severity: iso.#Severity

	// likelihood is how likely it is to occur
	likelihood: iso.#Likelihood

	// reversibility is whether it can be undone
	reversibility: #Reversibility

	// scale is roughly how many people are affected
	scale?: "Individual" | "Group" | "Community" | "Population"

	// duration is how long the consequence persists
	duration?: "Transient" | "Temporary" | "Persistent" | "Permanent"

	// source is what about the system produces the impact: a data property, a
	// model behaviour, a deployment decision
	source?: string

	// mitigations are the controls addressing it
	mitigations?: [iso.#Reference, ...iso.#Reference]

	// residual is the impact expected to remain once mitigations work as
	// intended
	residual?: #ResidualImpact

	// evidence substantiates the assessment of this impact
	evidence?: [iso.#Evidence, ...iso.#Evidence]

	// group references a group declared by this document
	group?: string
}

// DifferentiatedImpact records that a consequence does not fall evenly
#DifferentiatedImpact: {
	// groups are the populations bearing more of it
	groups: [string, ...string]

	// description explains why the impact is uneven
	description: string

	// basis names the characteristic the difference tracks, where it maps to
	// a protected characteristic
	basis?: [string, ...string]
}

// ResidualImpact is what remains after mitigation
#ResidualImpact: {
	// severity is the remaining consequence for those affected
	severity: iso.#Severity

	// justification explains why the remainder is acceptable
	justification: string

	// accepted-by is the party accepting it on the organisation's behalf.
	// Somebody has to own an impact borne by people who did not choose it.
	"accepted-by": gemara.#Contact

	// redress states what recourse an affected party has when the impact
	// materialises for them
	redress?: string
}

// ImpactConclusion is the overall judgement of the assessment
#ImpactConclusion: {
	// outcome is the decision reached
	outcome: "Proceed" | "Proceed With Conditions" | "Do Not Proceed" | "Suspend"

	// narrative explains the judgement
	narrative: string

	// conditions are what must hold for a conditional outcome, and are
	// required when the outcome is conditional
	conditions?: [string, ...string]

	// approved-by is the party accountable for the conclusion
	"approved-by": gemara.#Contact

	if outcome == "Proceed With Conditions" {
		conditions!: [string, ...string]
	}
}

// Consultation records asking affected parties what they think
#Consultation: {
	// party is who was consulted
	party: iso.#Reference

	// method is how they were consulted
	method: string

	// date is when
	date?: gemara.#Datetime

	// summary is what they said
	summary: string

	// influence records what changed as a result, since consultation that
	// changes nothing is a formality
	influence?: string
}
