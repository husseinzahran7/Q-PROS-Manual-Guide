const SENSITIVE_PATTERN = /(password|passcode|secret|token|api[-_ ]?key|card|credit|cvv|cvc|ssn|social|otp|2fa|mfa)/i;

export function isSensitiveField(input: {
  type?: string | null;
  autocomplete?: string | null;
  name?: string | null;
  id?: string | null;
  placeholder?: string | null;
  ariaLabel?: string | null;
}) {
  if (input.type?.toLowerCase() === "password") {
    return true;
  }
  const combined = [input.autocomplete, input.name, input.id, input.placeholder, input.ariaLabel].filter(Boolean).join(" ");
  return SENSITIVE_PATTERN.test(combined);
}

export function sanitizeValue(value: string | undefined, sensitive: boolean, type?: string | null) {
  if (type?.toLowerCase() === "password") {
    return undefined;
  }
  if (!value) {
    return value;
  }
  return sensitive ? "[MASKED]" : value;
}

export function runtimeVariableName(actionTitle: string, stepNumber: number) {
  const slug = actionTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return `${slug || "step"}_${stepNumber}`;
}

// Privacy gate: an action's value must be treated as runtime/masked when it
// is flagged sensitive, even if a stale valuePolicy still says "literal".
// Exporters must use this — never valuePolicy alone — so a user toggling a
// step to Sensitive after capture (or an old recording) can't leak cleartext.
export function shouldMaskAction(action: { sensitive?: boolean; valuePolicy?: string | null }) {
  if (action.sensitive) return true;
  return action.valuePolicy === "runtime" || action.valuePolicy === "masked";
}

export const MASKED_PLACEHOLDER = "[MASKED]";

export function maskExportValue(
  action: { sensitive?: boolean; valuePolicy?: string | null; value?: string | null }
): string | undefined {
  if (shouldMaskAction(action)) return undefined;
  return action.value ?? undefined;
}
