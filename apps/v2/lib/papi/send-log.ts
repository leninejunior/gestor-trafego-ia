import fs from "node:fs";
import path from "node:path";

type LogLevel = "info" | "warn" | "error";

const PAPI_LOG_PATH = path.resolve(process.cwd(), "reports", "gt18-papi-send.log");

export function logPapiEvent(level: LogLevel, event: string, details: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...details,
  };

  const serialized = JSON.stringify(entry);
  const consolePrefix =
    level === "error" ? "PAPI ERROR" : level === "warn" ? "PAPI WARN" : "PAPI INFO";

  if (level === "error") {
    console.error(`[${consolePrefix}] ${serialized}`);
  } else if (level === "warn") {
    console.warn(`[${consolePrefix}] ${serialized}`);
  } else {
    console.log(`[${consolePrefix}] ${serialized}`);
  }

  try {
    fs.mkdirSync(path.dirname(PAPI_LOG_PATH), { recursive: true });
    fs.appendFileSync(PAPI_LOG_PATH, `${serialized}\n`, "utf-8");
  } catch {
    // sem propagacao de erro de log em disco para nao interromper fluxo de envio.
  }
}
