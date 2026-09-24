// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// DatasetRegister is the inventory of data resources used to develop, train,
// test, tune or operate AI systems, and the terms on which each may be used.
//
// ISO/IEC 42001 Annex A.7.2–A.7.6 (data for development, acquisition, quality,
// provenance, preparation) and A.4.3 (data resources). Gemara treats data as a
// governed dependency; the standard wants the dataset itself to carry its
// permitted uses, its origin and its quality, because those are what make a
// downstream use lawful or unlawful, safe or unsafe.
//
// Provenance is referenced rather than modelled: lineage formats already exist
// and this register should point at them, not reinvent them.
#DatasetRegister: {
	iso.#Document
	metadata: type: "DatasetRegister"

	// datasets are the data resources in scope
	datasets: [#Dataset, ...#Dataset]

	// review states how often the register is revisited
	review?: iso.#Review

	_uniqueDatasetIds: {for i, d in datasets {(d.id): i}}
}

// DataStage is where in the AI lifecycle a dataset is used, which changes what
// obligations attach to it
#DataStage: "Training" |
	"Validation" |
	"Testing" |
	"Fine-tuning" |
	"Evaluation" |
	"Retrieval" |
	"Inference Input" |
	"Monitoring"

// Dataset is one governed data resource
#Dataset: {
	// id allows this dataset to be referenced by other elements
	id: string

	// name is what the dataset is called
	name: string

	// description explains what it contains
	description: string

	// version identifies the version of the data this entry describes
	version?: string

	// owner is accountable for the dataset
	owner: gemara.#RACI

	// stages are the lifecycle stages the data is used in
	stages: [#DataStage, ...#DataStage]

	// purpose states what the data may be used for
	purpose: string

	// permitted-uses are the uses the data's terms allow
	"permitted-uses"?: [string, ...string]

	// prohibited-uses are the uses its terms forbid. Training on data
	// acquired for another purpose is the common failure, so the constraint
	// travels with the data rather than living in a contract nobody reads.
	"prohibited-uses"?: [string, ...string]

	// sensitivity is the classification of the content
	sensitivity?: string

	// personal-data states whether the dataset contains data about people,
	// which pulls in obligations from outside this standard
	"personal-data": bool

	// special-categories names the sensitive categories present, where
	// personal data includes them
	"special-categories"?: [string, ...string]

	// acquisition records where the data came from and on what terms
	acquisition?: #DataAcquisition

	// provenance references a lineage record rather than restating it
	provenance?: #DataProvenance

	// preparation are the governed activities that transformed the data,
	// which is where preparation is recorded rather than described here
	preparation?: [iso.#Reference, ...iso.#Reference]

	// quality is the assessment of fitness for the intended purpose
	quality?: #DataQuality

	// retention is how long the data is kept and what happens after
	retention?: iso.#Retention

	// used-by are the AI systems built from or running on this data
	"used-by"?: [iso.#Reference, ...iso.#Reference]

	// risks are the risks arising from this data
	risks?: [iso.#Reference, ...iso.#Reference]

	// group references a group declared by this document
	group?: string
}

// DataAcquisition records where data came from and on what terms
#DataAcquisition: {
	// method is how it was obtained
	method: "Collected" |
		"Purchased" |
		"Licensed" |
		"Public" |
		"Scraped" |
		"Synthetic" |
		"Derived" |
		"Contributed"

	// source names where it came from
	source: string

	// supplier references the supplier it was obtained from
	supplier?: iso.#Reference

	// date is when it was obtained
	date?: gemara.#Datetime

	// licence is the licence or contractual terms it is held under
	licence?: string

	// rights states what the organisation is entitled to do with it
	rights?: string

	// lawful-basis is the basis for processing personal data, where relevant
	"lawful-basis"?: string

	// consent describes the consent obtained, where consent is the basis
	consent?: string

	// evidence substantiates the terms claimed
	evidence?: [iso.#Evidence, ...iso.#Evidence]
}

// DataProvenance points at a lineage record for the data
#DataProvenance: {
	// description summarises the origin and processing history
	description?: string

	// format names the provenance representation used
	format?: string

	// reference points at the provenance record itself
	reference?: iso.#Reference

	// uri is where the provenance record can be retrieved
	uri?: =~"^(https?|file)://[^\\s]+$"
}

// DataQuality is the assessment of whether data is fit for its purpose
#DataQuality: {
	// assessed is when quality was last assessed
	assessed?: gemara.#Datetime

	// dimensions are the quality properties measured
	dimensions?: [#QualityDimension, ...#QualityDimension]

	// known-limitations are the quality problems the organisation knows about
	// and has decided to live with
	"known-limitations"?: [string, ...string]

	// representativeness describes how well the data represents the
	// population the system will be used on, which is the quality property
	// that most often produces differentiated impact
	representativeness?: string

	// evidence substantiates the assessment
	evidence?: [iso.#Evidence, ...iso.#Evidence]
}

// QualityDimension is one measured property of a dataset
#QualityDimension: {
	// name is the property measured, such as completeness or accuracy
	name: string

	// measure is how it was measured
	measure?: string

	// threshold is the level required for the intended purpose
	threshold?: string

	// result is what was measured
	result?: string

	// status is whether the data meets the requirement
	status?: "Met" | "Not Met" | "Not Assessed"
}
