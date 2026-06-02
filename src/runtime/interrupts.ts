export function extractInterrupts(result: unknown): unknown[] {
  const value = result as any;
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.__interrupt__)) return value.__interrupt__;
  if (value.__interrupt__) return [value.__interrupt__];
  return [];
}

export function interruptPayload(interruptValue: unknown): unknown {
  const value = interruptValue as any;
  return value?.value ?? value;
}
