import crypto from "node:crypto";

export const calculateChecksum = (content: string): string => {
  return crypto.createHash("sha256").update(content).digest("hex");
};

export const splitStatements = (sql: string): string[] => {
  const statements: string[] = [];
  let current = "";
  let isSingleQuoted = false;
  let isDoubleQuoted = false;
  let isLineComment = false;
  let isBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (isLineComment) {
      current += char;

      if (char === "\n") {
        isLineComment = false;
      }

      continue;
    }

    if (isBlockComment) {
      current += char;

      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        isBlockComment = false;
      }

      continue;
    }

    if (!isSingleQuoted && !isDoubleQuoted) {
      if (char === "-" && next === "-") {
        current += char + next;
        index += 1;
        isLineComment = true;
        continue;
      }

      if (char === "/" && next === "*") {
        current += char + next;
        index += 1;
        isBlockComment = true;
        continue;
      }
    }

    if (char === "'" && !isDoubleQuoted) {
      const prev = sql[index - 1];
      const isEscaped = prev === "\\" && sql[index - 2] !== "\\";

      if (!isEscaped) {
        isSingleQuoted = !isSingleQuoted;
      }
    } else if (char === '"' && !isSingleQuoted) {
      const prev = sql[index - 1];
      const isEscaped = prev === "\\" && sql[index - 2] !== "\\";

      if (!isEscaped) {
        isDoubleQuoted = !isDoubleQuoted;
      }
    }

    if (char === ";" && !isSingleQuoted && !isDoubleQuoted) {
      const trimmed = current.trim();

      if (trimmed.length > 0) {
        statements.push(trimmed);
      }

      current = "";
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();

  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
};
