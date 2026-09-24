// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// AISystemRegister is the inventory of AI systems the management system
// governs, and what each is and is not for.
//
// ISO/IEC 42001 Annex A.6 (AI system lifecycle), A.9.4 (intended use), A.8.2
// (information for users) and A.6.2.7 (technical documentation). Intended use
// is the load-bearing field: most of the standard's obligations are relative to
// what the system is for, so a system without a recorded intent cannot be
// assessed for impact, monitored for drift from purpose, or used responsibly.
//
// The register describes governance, not architecture. Model cards, system
// cards, architecture and evaluation reports are referenced rather than
// restated, so this does not become a second copy of the engineering record.
#AISystemRegister: {
	iso.#Document
	metadata: type: "AISystemRegister"

	// systems are the AI systems in scope
	systems: [#AISystem, ...#AISystem]

	// review states how often the register is revisited
	review?: iso.#Review

	_uniqueSystemIds: {for i, s in systems {(s.id): i}}
}

// AIRole is the organisation's relationship to the system, which determines
// which of the standard's obligations fall on it
#AIRole: "Developer" | "Provider" | "Deployer" | "User" | "Data Provider" | "Partner"

// AILifecycleStage is where the system has got to
#AILifecycleStage: "Conception" |
	"Design" |
	"Development" |
	"Verification and Validation" |
	"Deployment" |
	"Operation" |
	"Monitoring" |
	"Re-evaluation" |
	"Retirement"

// AISystem is one governed AI system
#AISystem: {
	// id allows this system to be referenced by other elements
	id: string

	// name is what the system is called
	name: string

	// description explains what it does
	description: string

	// version is the version of the system this entry describes
	version?: string

	// role is the organisation's relationship to the system
	role: [#AIRole, ...#AIRole]

	// stage is where in the lifecycle the system currently sits
	stage: #AILifecycleStage

	// owner is accountable for the system
	owner: gemara.#RACI

	// intended-use is what the system is for. Annex A.9.4 makes this the
	// reference point against which actual use is judged.
	"intended-use": #IntendedUse

	// autonomy describes how much the system decides on its own, and what a
	// human can still do about it
	autonomy?: #HumanOversight

	// techniques names the AI techniques used, where the approach bears on
	// the governance, such as machine learning versus rule-based inference
	techniques?: [string, ...string]

	// datasets are the data resources the system is built from or runs on
	datasets?: [iso.#Reference, ...iso.#Reference]

	// tools are the tooling resources used to build, evaluate or run it
	tools?: [iso.#Reference, ...iso.#Reference]

	// dependencies are the external systems, models and services it relies on
	dependencies?: [iso.#Reference, ...iso.#Reference]

	// activity is the Gemara sensitive activity this system participates in
	activity?: iso.#Reference

	// impact-assessments are the impact assessments performed on this system
	"impact-assessments"?: [iso.#Reference, ...iso.#Reference]

	// risk-assessments are the risk assessments covering it
	"risk-assessments"?: [iso.#Reference, ...iso.#Reference]

	// documentation references the technical and user-facing material that
	// describes the system, rather than restating it here
	documentation?: [#SystemDocument, ...#SystemDocument]

	// event-logging describes what the system records about its own
	// operation, which Annex A.6.2.8 requires to be sufficient for
	// traceability and investigation
	"event-logging"?: #EventLogging

	// monitoring describes how the system is watched in operation
	monitoring?: [iso.#Reference, ...iso.#Reference]

	// group references a group declared by this document
	group?: string
}

// IntendedUse states what a system is for, and what it is not for. Foreseeable
// misuse is separated from prohibited use: one is a prediction the organisation
// must plan for, the other is a rule it imposes.
#IntendedUse: {
	// purpose is what the system is meant to achieve
	purpose: string

	// domain is the setting it is intended for
	domain?: string

	// users are the classes of people expected to use it
	users?: [string, ...string]

	// subjects are the people the system makes or informs decisions about,
	// who are frequently not its users
	subjects?: [string, ...string]

	// prohibited are the uses the organisation forbids
	prohibited?: [string, ...string]

	// foreseeable-misuse are the uses the organisation expects to occur
	// despite being unintended, which impact assessment must consider
	"foreseeable-misuse"?: [string, ...string]

	// limitations are the conditions under which the system should not be
	// relied on
	limitations?: [string, ...string]

	// out-of-scope-populations are groups the system is not validated for
	"out-of-scope-populations"?: [string, ...string]
}

// HumanOversight describes what the system decides alone and what a person can
// still do about it
#HumanOversight: {
	// level is how much the system does without a person in the loop
	level: "Advisory" | "Human In The Loop" | "Human On The Loop" | "Autonomous"

	// description explains the oversight arrangement
	description?: string

	// intervention states what a person can do when the system is wrong
	intervention?: string

	// override states whether a decision can be reversed, and by whom
	override?: string
}

// SystemDocument references material describing the system
#SystemDocument: {
	// type is the kind of document
	type: "Model Card" |
		"System Card" |
		"Architecture" |
		"Interface Specification" |
		"Evaluation Report" |
		"User Information" |
		"Data Sheet" |
		"Change Record"

	// title names the document
	title: string

	// uri is where it can be found
	uri?: =~"^(https?|file)://[^\\s]+$"

	// audience states who it is written for, since Annex A.8.2 requires
	// information users can actually act on
	audience?: "Internal" | "User" | "Customer" | "Regulator" | "Public"

	// version is the version of the document
	version?: string
}

// EventLogging describes what a system records about its own operation
#EventLogging: {
	// description states what is logged
	description: string

	// retention is how long the logs are kept
	retention?: string

	// evidence points at the log stream itself, so governance evidence and
	// operational telemetry can be joined up
	evidence?: [iso.#Evidence, ...iso.#Evidence]
}
