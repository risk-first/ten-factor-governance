import { isEnforcementLog } from "@gemara/react"
import { EnforcementLog } from "@gemara/react/enforcement-log"

import { ENFORCEMENT_LOG_URL } from "./receipts.js"
import { createLogScreen } from "./log-screen.js"

export const enforcementLogUI = createLogScreen({
  id: "sail-governance-enforcement-log",
  title: "Enforcement Log",
  url: ENFORCEMENT_LOG_URL,
  empty: "No enforcement receipts yet. Sail records forward or hold-and-GetApproval here.",
  isLog: isEnforcementLog,
  render: log => <EnforcementLog data={log} headingLevel={2} />,
})

export default enforcementLogUI
