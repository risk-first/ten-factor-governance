// SPDX-License-Identifier: Apache-2.0

// Schema lifecycle: experimental | stable | deprecated
@status("experimental")

// Package iso42001 defines the artifacts an Artificial Intelligence Management
// System needs that neither Gemara nor the shared ISO package already models.
//
// The division of labour is deliberate. Gemara types the governance content:
// principles, guidance, controls, threats, risks, policy, and the evaluation,
// enforcement and audit logs an activity produces. The shared `iso` package
// types the management-system envelope both ISO/IEC 27001 and ISO/IEC 42001
// require: context, scope, parties, obligations, objectives, applicability,
// risk assessment, competence, communication, review, corrective action,
// incidents. What is left here is what is specific to governing AI: the
// systems themselves, the data and tooling they are built from, the assessment
// of their consequences for people, and the obligations that follow from
// building them with and for other organisations.
//
// Clause references are to ISO/IEC 42001:2023. Requirement paraphrases in doc
// comments are not ISO normative text; conformity assessment needs a licensed
// copy of the standard.
package iso42001

import "github.com/finos/ten-factor-governance/schemas/iso/common:iso"

// AIMS names the documents that together constitute an Artificial Intelligence
// Management System, so a twin can be checked for completeness rather than
// merely for validity. Each field is the artifact answering one part of the
// standard; a management system missing one of the required fields is
// incomplete on its face.
//
// This is a profile, not a container: the fields reference documents that live
// and version on their own, rather than embedding them.
#AIMS: {
	// title names the management system
	title: string

	// scope is the AIMS scope statement (Clause 4.3)
	scope: iso.#Reference

	// context is the organisational context it was drawn against (Clause 4.1)
	context: iso.#Reference

	// parties is the register of interested and affected parties (Clause 4.2)
	parties: iso.#Reference

	// requirements are the interested-party requirements taken on (Clause 4.2)
	requirements: iso.#Reference

	// policy is the AI policy (Clause 5.2, Annex A.2.2)
	policy: iso.#Reference

	// objectives are the AI objectives and their metrics (Clause 6.2)
	objectives: iso.#Reference

	// risk-assessments are the AI risk assessments performed (Clauses 6.1.2, 8.2)
	"risk-assessments": [iso.#Reference, ...iso.#Reference]

	// impact-assessments are the AI system impact assessments (Clauses 6.1.4, 8.4)
	"impact-assessments": [iso.#Reference, ...iso.#Reference]

	// applicability is the Statement of Applicability (Clause 6.1.3)
	applicability: iso.#Reference

	// systems is the register of AI systems in scope (Annex A.6)
	systems: iso.#Reference

	// datasets is the register of data resources (Annex A.7)
	datasets?: iso.#Reference

	// tools is the register of tooling resources (Annex A.4.4)
	tools?: iso.#Reference

	// competence is the competence register (Clause 7.2)
	competence: iso.#Reference

	// communication is the communication plan (Clause 7.4)
	communication: iso.#Reference

	// suppliers is the supplier assurance register (Annex A.10.3)
	suppliers?: iso.#Reference

	// contracts are the governance contracts allocating responsibility to
	// other organisations (Annex A.10.2, A.10.4)
	contracts?: iso.#Reference

	// reporting are the external reporting obligations (Annex A.8.3)
	reporting?: iso.#Reference

	// audit-programme is the internal audit programme (Clause 9.2)
	"audit-programme": iso.#Reference

	// reviews are the management reviews held (Clause 9.3)
	reviews: [iso.#Reference, ...iso.#Reference]

	// corrective-actions is the nonconformity and corrective action log
	// (Clause 10.2)
	"corrective-actions": iso.#Reference

	// incidents is the incident log (Annex A.8.4)
	incidents?: iso.#Reference
}
