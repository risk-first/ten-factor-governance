// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

// ManagementReviewProgramme is how top management reviews the management
// system: how often, who must attend, what inputs must be considered, and what
// outputs each review must produce. It is the process, not a minute of one
// sitting.
//
// ISO/IEC 42001 and ISO/IEC 27001 Clause 9.3. Occurrence results (findings,
// decisions and actions from a specific review) belong with the evidence of
// that review — corrective-action records, decision logs, or a dedicated
// review record — not as the programme's primary content.
#ManagementReviewProgramme: {
	#Document
	metadata: type: "ManagementReviewProgramme"

	// frequency is how often top management conducts a review
	frequency: #Cadence

	// objectives state what each review is for
	objectives: [string, ...string]

	// chair is the party who leads reviews (Clause 9.3 places this on top
	// management)
	chair: #Reference

	// attendees are the parties who must take part
	attendees: [#Reference, ...#Reference]

	// required-inputs are the matters Clause 9.3 requires every review to
	// consider. Sources name where that class of input is drawn from; they are
	// not the results of a particular review.
	"required-inputs": [#RequiredReviewInput, ...#RequiredReviewInput]

	// required-outputs state what each review must produce
	"required-outputs": [#RequiredReviewOutput, ...#RequiredReviewOutput]

	// owner is accountable for running the programme
	owner: #Reference

	_uniqueInputIds: {for i, r in "required-inputs" {(r.id): i}}
	_uniqueOutputIds: {for i, r in "required-outputs" {(r.id): i}}
}

// RequiredReviewInput is one class of input every management review must
// consider
#RequiredReviewInput: {
	// id allows this input requirement to be referenced
	id: string

	// description names what must be considered
	description: string

	// sources point at the artifacts that supply this class of input
	sources?: [#Reference, ...#Reference]
}

// RequiredReviewOutput is one class of output every management review must
// produce
#RequiredReviewOutput: {
	// id allows this output requirement to be referenced
	id: string

	// description names what must be produced
	description: string
}
