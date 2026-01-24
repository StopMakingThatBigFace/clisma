export const resolveValue = (
  value: string,
  env: Record<string, string | undefined> = {},
  vars: Record<string, string> = {},
): string => {
  const envCallRegex = /^env\("([^"]+)"\)$/;
  const varRefRegex = /^var\.(\w+)$/;
  const interpolationRegex = /\$\{([^}]+)\}/g;

  const resolved = value.replace(interpolationRegex, (match, expr) => {
    const envExprMatch = expr.match(envCallRegex);
    if (envExprMatch) {
      return env[envExprMatch[1]] || "";
    }

    const varExprMatch = expr.match(varRefRegex);
    if (varExprMatch) {
      return vars[varExprMatch[1]] || "";
    }

    return match;
  });

  return resolved;
};

export const extractValue = <T>(
  value: T[] | T | undefined,
  defaultValue: T,
): T => {
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return value !== undefined ? (value as T) : defaultValue;
};

export const extractObject = <T extends Record<string, unknown>>(
  value: T[] | T | undefined,
  defaultValue: T,
): T => {
  if (Array.isArray(value)) {
    return (value[0] as T) || defaultValue;
  }
  return value !== undefined ? (value as T) : defaultValue;
};

export const extractList = <T>(
  value: T[] | T[][] | undefined,
  defaultValue: T[],
): T[] => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return defaultValue;
    }
    const first = value[0];
    if (Array.isArray(first)) {
      return first as T[];
    }
    return value as T[];
  }
  return defaultValue;
};
