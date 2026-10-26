import { useEffect, useState, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { GemaraProvider } from "@gemara/react/provider"
import {
  SAIL_CONFIG_UI,
  type SailExtensionConfigProps,
  type SailExtensionUI,
} from "@finos/sail-extension/ui"

type LogScreenOptions<T> = {
  id: string
  title: string
  url: string
  empty: string
  isLog: (value: unknown) => value is T
  render: (log: T) => ReactNode
}

export function createLogScreen<T extends { metadata?: { id?: string; date?: string } }>(
  options: LogScreenOptions<T>,
): SailExtensionUI {
  function ConfigScreen(_props: SailExtensionConfigProps) {
    const [logs, setLogs] = useState<T[]>([])
    const [ready, setReady] = useState(false)

    useEffect(() => {
      let cancelled = false
      async function load(): Promise<void> {
        try {
          const res = await fetch(options.url, { cache: "no-store" })
          const stored = res.ok ? ((await res.json()) as unknown) : []
          const next = Array.isArray(stored) ? stored.filter(options.isLog) : []
          if (!cancelled) {
            setLogs(next)
            setReady(true)
          }
        } catch {
          if (!cancelled) {
            setLogs([])
            setReady(true)
          }
        }
      }
      void load()
      const timer = window.setInterval(() => void load(), 2000)
      return () => {
        cancelled = true
        window.clearInterval(timer)
      }
    }, [])

    if (!ready) {
      return <p>Loading…</p>
    }
    if (logs.length === 0) {
      return <p style={{ margin: 0 }}>{options.empty}</p>
    }

    return (
      <GemaraProvider>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p style={{ margin: 0 }}>
            {logs.length} receipt{logs.length === 1 ? "" : "s"}, newest first.
          </p>
          {logs.map((log, index) => (
            <article
              key={log.metadata?.id ?? String(index)}
              style={{
                border: "1px solid #d0d5dd",
                borderRadius: "8px",
                padding: "1rem",
              }}
            >
              {options.render(log)}
            </article>
          ))}
        </div>
      </GemaraProvider>
    )
  }

  function mount(el: HTMLElement, props: SailExtensionConfigProps): () => void {
    const root = createRoot(el)
    root.render(<ConfigScreen {...props} />)
    return () => {
      root.unmount()
    }
  }

  return {
    id: options.id,
    title: options.title,
    type: SAIL_CONFIG_UI,
    ConfigScreen,
    mount,
  }
}
