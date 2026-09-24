// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso42001

import (
	"github.com/gemaraproj/gemara@v1:gemara"
	"github.com/finos/ten-factor-governance/schemas/iso/common:iso"
)

// ToolResourceRegister is the inventory of tooling, computing and human
// resources the AI lifecycle depends on.
//
// ISO/IEC 42001 Annex A.4.2–A.4.6 (resource documentation, data, tooling,
// system and computing, human resources). Data resources are significant
// enough to have their own register; everything else the standard asks to be
// identified lives here. The point is not asset management for its own sake:
// a tool that trains a model or gates its release is part of the governed
// factory, and Annex A.4 asks which ones those are.
#ToolResourceRegister: {
	iso.#Document
	metadata: type: "ToolResourceRegister"

	// resources are the tooling, compute and human resources in scope
	resources: [#ToolResource, ...#ToolResource]

	// review states how often the register is revisited
	review?: iso.#Review

	_uniqueResourceIds: {for i, r in resources {(r.id): i}}
}

// ResourceKind is what sort of resource is being recorded
#ResourceKind: "Tooling" |
	"Model" |
	"Compute" |
	"Infrastructure" |
	"Service" |
	"Human" |
	"Financial"

// ToolFunction is what a tool is used for in the AI lifecycle
#ToolFunction: "Data Preparation" |
	"Training" |
	"Evaluation" |
	"Validation" |
	"Deployment" |
	"Monitoring" |
	"Annotation" |
	"Experimentation" |
	"Governance"

// ToolResource is one resource the AI lifecycle depends on
#ToolResource: {
	// id allows this resource to be referenced by other elements
	id: string

	// name is what the resource is called
	name: string

	// kind is what sort of resource it is
	kind: #ResourceKind

	// description explains what it provides
	description?: string

	// functions are what it is used for, for tooling and services
	functions?: [#ToolFunction, ...#ToolFunction]

	// version is the version in use
	version?: string

	// supplier references the supplier providing it, where it is external
	supplier?: iso.#Reference

	// external distinguishes resources the organisation controls from those
	// it does not, which determines whether assurance is needed
	external?: bool

	// owner is accountable for the resource
	owner?: gemara.#RACI

	// capacity describes how much is available, for compute, financial and
	// human resources where sufficiency is the governance question
	capacity?: string

	// competences are the competence requirements attached, for human
	// resources
	competences?: [iso.#Reference, ...iso.#Reference]

	// used-by are the AI systems depending on this resource
	"used-by"?: [iso.#Reference, ...iso.#Reference]

	// controls are the controls governing its use
	controls?: [iso.#Reference, ...iso.#Reference]

	// risks are the risks arising from depending on it
	risks?: [iso.#Reference, ...iso.#Reference]

	// group references a group declared by this document
	group?: string
}
