function redact(value: string): string {
  return value
    .replace(/(sk-|api[_-]?key|token)[=:]\s*\S+/gi, "$1=***")
    .replace(/"(token|apiKey|api_key)"\s*:\s*"[^"]+"/gi, '"$1":"***"');
}

export function logInfo(message: string, extra?: Record<string, unknown>): void {
  const line = extra ? `${message} ${JSON.stringify(extra)}` : message;
  console.log(`[anvil-host] ${redact(line)}`);
}

export function logError(message: string, extra?: Record<string, unknown>): void {
  const line = extra ? `${message} ${JSON.stringify(extra)}` : message;
  console.error(`[anvil-host] ${redact(line)}`);
}
