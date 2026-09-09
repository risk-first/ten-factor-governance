// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// AIPolicy is a Gemara policy carrying the organisational commitments
// ISO/IEC 42001 requires an AI policy to make.
//
// Clause 5.2 and Annex A.2.2–A.2.4. Gemara's Policy is already the operational
// article: it imports controls, treats risks and states how adherence is
// evaluated and enforced. What ISO adds is the management-system half — that
// the policy is appropriate to the organisation's purpose, states commitments,
// frames the objectives, is approved by top management and is reviewed on a
// stated cadence.
//
// This is an extension rather than a replacement: every Gemara field keeps its
// meaning and a Gemara reader finds everything it expects, so one document both
// drives a pipeline and answers an auditor. Note that gemara.#Policy is closed,
// so the ISO additions below make the document fail a strict validation against
// #Policy alone — validate AI policies against #AIPolicy.
#AIPolicy: {
	gemara.#Policy

	// purpose states how the policy fits the organisation's purpose and
	// strategic direction, which Clause 5.2 requires it to be appropriate to
	purpose: string

	// commitments are what the organisation binds itself to, such as
	// meeting applicable requirements and continually improving the AIMS
	commitments: [#PolicyCommitment, ...#PolicyCommitment]

	// objectives references the management objectives this policy frames.
	// ISO requires the policy to provide a framework for setting them.
	objectives?: iso.#Reference

	// aligned-with are the other organisational policies this one must sit
	// consistently beside, such as security, privacy and data policies
	// (Annex A.2.3)
	"aligned-with"?: [iso.#Reference, ...iso.#Reference]

	// approval records top-management sign-off. Clause 5.2 makes this a
	// leadership duty, so an unapproved AI policy is not one.
	approval: iso.#Approval

	// review states the cadence and triggers for revisiting the policy
	// (Annex A.2.4)
	review: iso.#Review

	// communication references the communication requirements that get the
	// policy to the people who must follow it and the parties entitled to see
	// it (Clause 5.2 and Annex A.8.5)
	communication?: [iso.#Reference, ...iso.#Reference]

	...
}

// PolicyCommitment is one thing the organisation binds itself to
#PolicyCommitment: {
	// id allows this commitment to be referenced by other elements
	id: string

	// statement is the commitment as published
	statement: string

	// type distinguishes the commitments ISO expects to find from the ones
	// the organisation adds
	type?: "Requirements" |
		"Continual Improvement" |
		"Resources" |
		"Responsible Use" |
		"Transparency" |
		"Other"

	// objectives are the management objectives that make the commitment
	// measurable, since a commitment nothing measures is a slogan
	objectives?: [iso.#Reference, ...iso.#Reference]
}
