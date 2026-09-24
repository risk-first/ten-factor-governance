// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// RiskAssessment is one dated pass of the risk-assessment process: the
// criteria used, who did it, what they found and what was decided.
//
// ISO/IEC 42001 Clauses 6.1.2 and 8.2; ISO/IEC 27001 Clause 6.1.2 with the
// ISO/IEC 27005 lifecycle underneath. Gemara's RiskCatalog holds the standing
// list of risks the organisation recognises; this holds the assessment
// instance that rated them, which is what ISO asks to be retained and repeated
// at planned intervals.
#RiskAssessment: {
	#Document
	metadata: type: "RiskAssessment"

	// subject is what was assessed: an AI system, an activity, a scope item
	subject: #Reference

	// context describes the circumstances the assessment was made under,
	// which is what makes a later reassessment comparable
	context: string

	// criteria are the scales and thresholds applied. ISO requires a
	// repeatable method, so the method travels with the results.
	criteria: #RiskCriteria

	// assessor is who performed the assessment
	assessor: gemara.#Actor

	// date is when the assessment was performed
	date: gemara.#Datetime

	// trigger is why this assessment was run
	trigger: "Planned" | "Initial" | "Change" | "Incident" | "Review" | "Ad hoc"

	// entries are the risks rated by this assessment
	entries: [#RiskAssessmentEntry, ...#RiskAssessmentEntry]

	// conclusion summarises what the assessment found
	conclusion?: string

	// impact-assessments are the impact assessments feeding this one. ISO/IEC
	// 42001 requires impact-assessment results to inform risk assessment.
	"impact-assessments"?: [#Reference, ...#Reference]

	// applicability-profile is the treatment record this assessment produced
	"applicability-profile"?: #Reference

	// review states when the next assessment is due and what forces it early
	review?: #Review

	// evidence substantiates the assessment itself
	evidence?: [#Evidence, ...#Evidence]

	_uniqueEntryIds: {for i, e in entries {(e.id): i}}
}

// RiskCriteria are the scales and thresholds an assessment applied
#RiskCriteria: {
	// methodology names the method followed, e.g. "ISO/IEC 27005:2022 §8"
	methodology: string

	// likelihood-scale describes what each likelihood level means here
	"likelihood-scale"?: [#ScalePoint, ...#ScalePoint]

	// consequence-scale describes what each severity level means here
	"consequence-scale"?: [#ScalePoint, ...#ScalePoint]

	// acceptance states the threshold above which risk cannot be accepted
	// without escalation
	acceptance: string

	// appetite is the organisation's stated tolerance for the risk category
	// being assessed
	appetite?: gemara.#RiskAppetite
}

// ScalePoint gives one level of a scale a meaning specific to this assessment
#ScalePoint: {
	// level is the name of the point on the scale
	level: string

	// description explains what qualifies for it
	description: string
}

// TreatmentOption is what the organisation decided to do about a risk
#TreatmentOption: "Mitigate" | "Accept" | "Avoid" | "Transfer" | "Share"

// RiskAssessmentEntry is one risk as rated by this assessment
#RiskAssessmentEntry: {
	// id allows this entry to be referenced by other elements
	id: string

	// risk references the risk in a Gemara RiskCatalog being rated. Ratings
	// belong to the assessment; the risk itself belongs to the catalog.
	risk: #Reference

	// threats are the threats considered as sources of this risk
	threats?: [#Reference, ...#Reference]

	// likelihood is the assessed chance before treatment
	likelihood: #Likelihood

	// consequence is the assessed impact before treatment
	consequence: #Severity

	// rating is the resulting inherent risk level
	rating: #Severity

	// analysis explains how the rating was arrived at
	analysis?: string

	// treatment is what was decided
	treatment: #TreatmentOption

	// controls are the controls selected to treat the risk
	controls?: [#Reference, ...#Reference]

	// residual is the exposure expected once treatment is working
	residual?: #ResidualRisk

	// owner is the risk owner accountable for the treatment decision
	owner: gemara.#Contact

	// actions are the work the treatment decision commits somebody to
	actions?: [#Action, ...#Action]
}
