// SPDX-License-Identifier: Apache-2.0

@status("experimental")
package iso

import "github.com/gemaraproj/gemara@v1:gemara"

// ManagementObjectiveCatalog holds the measurable objectives the management
// system sets itself, the metrics that answer them and the results measured
// against those metrics.
//
// ISO/IEC 42001 and ISO/IEC 27001 Clauses 6.2 and 9.1; ISO/IEC 42001 Annex
// A.6.1.2 and A.9.3 add objectives for responsible development and use.
// Gemara measures whether a control holds; nothing measures whether the
// programme is achieving what it set out to.
#ManagementObjectiveCatalog: {
	#Document
	metadata: type: "ManagementObjectiveCatalog"

	// objectives are what the management system is trying to achieve
	objectives: [#ManagementObjective, ...#ManagementObjective]

	// review states how often objectives are revisited
	review?: #Review

	_uniqueObjectiveIds: {for i, o in objectives {(o.id): i}}
}

// ManagementObjective is one measurable thing the management system is
// trying to achieve
#ManagementObjective: {
	// id allows this objective to be referenced by other elements
	id: string

	// title describes the objective at a glance
	title: string

	// description explains what achieving it looks like
	description: string

	// group references a group declared by this document
	group?: string

	// owner is accountable for achieving the objective
	owner: gemara.#RACI

	// policy is the policy this objective serves. ISO requires objectives to
	// be consistent with the policy, which is only checkable if the link is
	// recorded.
	policy?: #Reference

	// requirements are the stakeholder requirements this objective answers
	requirements?: [#Reference, ...#Reference]

	// metrics are how achievement is measured. An objective without one is
	// not measurable, which is what Clause 6.2 asks for.
	metrics: [#Metric, ...#Metric]

	// resources are what has been committed to achieving it
	resources?: [string, ...string]

	// actions are the work planned to achieve the objective
	actions?: [#Action, ...#Action]

	// status is where the objective has got to
	status: "Proposed" | "Active" | "Achieved" | "Missed" | "Withdrawn"

	// period is the window the objective is set for
	period?: #Period

	_uniqueMetricIds: {for i, m in metrics {(m.id): i}}
}

// Metric is a measurement that answers whether an objective is being met
#Metric: {
	// id allows this metric to be referenced by other elements
	id: string

	// name is what is being measured
	name: string

	// method is how the measurement is taken
	method: string

	// unit is what the value is expressed in
	unit?: string

	// frequency is how often it is taken
	frequency: #Cadence

	// target is the value that counts as success
	target: #Target

	// source is where the measurement comes from, typically a Gemara
	// EvaluationLog or an external monitoring system
	source?: #Reference

	// results are the measurements taken so far
	results?: [#MetricResult, ...#MetricResult]
}

// Target is the value a metric is aiming at
#Target: {
	// description states the target in words, for targets that resist a number
	description?: string

	// value is the numeric target
	value?: number

	// comparator states how a measurement is compared with the target
	comparator?: "<" | "<=" | "=" | ">=" | ">"

	// threshold is the value below which the objective is considered missed,
	// where that differs from the target
	threshold?: number
}

// MetricResult is one measurement of a metric
#MetricResult: {
	// period is the window measured
	period: #Period

	// value is what was measured
	value?: number

	// narrative describes the result where a number does not carry it
	narrative?: string

	// status is the assessment of this result against the target
	status: "Met" | "Not Met" | "Partially Met" | "Not Measured"

	// evidence substantiates the measurement
	evidence?: [#Evidence, ...#Evidence]

	// measured is when the measurement was taken
	measured?: gemara.#Datetime
}
