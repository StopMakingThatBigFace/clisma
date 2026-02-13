function stripLineComments(line) {
  const hash = line.indexOf("#");
  const slash = line.indexOf("//");

  if (hash === -1 && slash === -1) return line;
  if (hash === -1) return line.slice(0, slash);
  if (slash === -1) return line.slice(0, hash);

  return line.slice(0, Math.min(hash, slash));
}

function stripStrings(line) {
  let result = "";
  let inString = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    const escaped = prev === "\\";

    if (ch === '"' && !escaped) {
      inString = !inString;
      result += " ";
      continue;
    }

    result += inString ? " " : ch;
  }

  return result;
}

function countChar(line, char) {
  return (line.match(new RegExp(`\\${char}`, "g")) || []).length;
}

function isInsideString(linePrefix) {
  let inString = false;

  for (let i = 0; i < linePrefix.length; i += 1) {
    const ch = linePrefix[i];
    const prev = i > 0 ? linePrefix[i - 1] : "";
    const escaped = prev === "\\";

    if (ch === '"' && !escaped) {
      inString = !inString;
    }
  }

  return inString;
}

function extractAssignedValue(line) {
  const idx = line.indexOf("=");
  if (idx === -1) return "";
  return line.slice(idx + 1).trim();
}

module.exports = {
  stripLineComments,
  stripStrings,
  countChar,
  isInsideString,
  extractAssignedValue,
};
