import { isEvaluationLog } from "@gemara/react"
import { EvaluationLog } from "@gemara/react/evaluation-log"

import { EVALUATION_LOG_URL } from "./receipts.js"
import { createLogScreen } from "./log-screen.js"

export const evaluationLogUI = createLogScreen({
  id: "sail-governance-evaluation-log",
  title: "Evaluation Log",
  url: EVALUATION_LOG_URL,
  empty: "No evaluation receipts yet. Unsigned demo.SubmitOrder raises write a Layer 5 log.",
  isLog: isEvaluationLog,
  render: log => <EvaluationLog data={log} headingLevel={2} />,
})

export default evaluationLogUI
