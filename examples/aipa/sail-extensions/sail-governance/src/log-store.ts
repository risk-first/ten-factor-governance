import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { EnforcementLogData as EnforcementLog, EvaluationLogData as EvaluationLog } from "@gemara/react"

const TEMP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../temp")

export const EVALUATION_LOG_PATH = path.join(TEMP_DIR, "evaluation-log.json")
export const ENFORCEMENT_LOG_PATH = path.join(TEMP_DIR, "enforcement-log.json")

function readArray<T>(dest: string): T[] {
  if (!fs.existsSync(dest)) {
    return []
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dest, "utf-8")) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeArray<T>(dest: string, entries: T[]): void {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
  fs.writeFileSync(dest, `${JSON.stringify(entries, null, 2)}\n`, "utf-8")
}

export function appendReceipts(evaluation: EvaluationLog, enforcement: EnforcementLog): void {
  writeArray(EVALUATION_LOG_PATH, [evaluation, ...readArray<EvaluationLog>(EVALUATION_LOG_PATH)])
  writeArray(ENFORCEMENT_LOG_PATH, [enforcement, ...readArray<EnforcementLog>(ENFORCEMENT_LOG_PATH)])
}
