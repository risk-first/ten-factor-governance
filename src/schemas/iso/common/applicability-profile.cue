// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// ApplicabilityProfile is the Statement of Applicability: for every control in
// the reference set, whether it applies, why, whether it is implemented, and
// what risk it treats.
//
// ISO/IEC 42001 and ISO/IEC 27001 Clause 6.1.3. Gemara can import a control
// catalog and a policy can exclude entries, but the explicit decision record —
// including the controls deliberately not applied — has nowhere to live.
#ApplicabilityProfile: {
	#Document
	metadata: type: "ApplicabilityProfile"

	// reference-set names the control set being ranged over, e.g. "ISO/IEC
	// 42001:2023 Annex A". The controls themselves are cited per decision.
	"reference-set": string

	// risk-assessment is the assessment whose treatment decisions this profile
	// records the outcome of
	"risk-assessment"?: #Reference

	// decisions are the applicability decisions, one per control in the
	// reference set. Completeness is the point of the artifact: a control
	// missing from this list is a control nobody has ruled on.
	decisions: [#ApplicabilityDecision, ...#ApplicabilityDecision]

	// review states how often the profile is revisited
	review?: #Review

	_uniqueDecisionIds: {for i, d in decisions {(d.id): i}}
}

// ImplementationState is how far an applicable control has got
#ImplementationState: "Planned" |
	"Partially Implemented" |
	"Implemented" |
	"Not Implemented" |
	"Retired"

// ApplicabilityDecision is the ruling on a single control
#ApplicabilityDecision: {
	// id allows this decision to be referenced by other elements
	id: string

	// control references the control being ruled on
	control: #Reference

	// applicable is the ruling itself
	A="applicable": bool

	// justification explains the ruling. ISO requires reasons both for
	// inclusion and for exclusion, so it is required either way.
	justification: string

	// state is how far implementation has got. Only meaningful for controls
	// ruled applicable, and required for them.
	state?: #ImplementationState

	if A {
		state!: #ImplementationState
	}
	if !A {
		state?: _|_
	}

	// risks are the risks this control treats
	risks?: [#Reference, ...#Reference]

	// requirements are the stakeholder requirements the control satisfies
	requirements?: [#Reference, ...#Reference]

	// owner is accountable for the control being in the state claimed
	owner?: gemara.#Contact

	// due is when an unimplemented control is expected to be in place
	due?: gemara.#Datetime

	// residual-risk is the exposure accepted once the control is working as
	// described, or the whole exposure where the control is not applied
	"residual-risk"?: #ResidualRisk

	// implementation describes how the control is realised here, where the
	// organisation's implementation differs from the catalog's description
	implementation?: string

	// evidence substantiates the claimed state
	evidence?: [#Evidence, ...#Evidence]

	// policies are the policies that carry this control into effect
	policies?: [#Reference, ...#Reference]
}

// ResidualRisk is exposure remaining after treatment, and who accepted it
#ResidualRisk: {
	// severity is the remaining exposure
	severity: #Severity

	// accepted-by is the party that accepted it. ISO requires risk owners to
	// approve residual risk, so an acceptance without a name is incomplete.
	"accepted-by": gemara.#Contact

	// date is when it was accepted
	date?: gemara.#Datetime

	// justification explains why the remaining exposure is tolerable
	justification?: string

	// review is when the acceptance lapses and must be taken again
	review?: gemara.#Datetime
}
