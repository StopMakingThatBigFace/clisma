const {
  stripLineComments,
  stripStrings,
  countChar,
  extractAssignedValue,
} = require("./text");
const {
  parseVariableTypeValue,
  normalizeExpectedType,
  inferValueType,
  isTypeCompatible,
} = require("./types");

function collectDeclaredVariablesWithTypes(document) {
  const variableTypes = {};
  const stack = [];

  for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
    const originalLine = document.lineAt(lineNumber).text;
    const lineNoComments = stripLineComments(originalLine);
    const line = stripStrings(lineNoComments);

    const variableBlockMatch = lineNoComments.match(
      /^\s*variable\s+"([^"]+)"\s*\{\s*$/,
    );
    const assignmentMatch = line.match(/^\s*([a-zA-Z_][\w-]*)\s*=/);

    if (variableBlockMatch) {
      stack.push({ kind: "variable", name: variableBlockMatch[1], type: "" });
    } else if (assignmentMatch && stack.length > 0) {
      const key = assignmentMatch[1];
      const top = stack[stack.length - 1];

      if (top.kind === "variable" && key === "type") {
        const rawValue = extractAssignedValue(lineNoComments);
        const parsed = parseVariableTypeValue(rawValue);
        if (parsed.valid) {
          top.type = parsed.typeName;
        }
      }
    }

    let closeCount = countChar(line, "}");
    while (closeCount > 0 && stack.length > 0) {
      const popped = stack.pop();
      if (popped && popped.kind === "variable" && popped.name && popped.type) {
        variableTypes[popped.name] = popped.type;
      }
      closeCount -= 1;
    }
  }

  return variableTypes;
}

function validateVarsEntryType(key, rawValue, declaredVariableTypes) {
  const declaredType = declaredVariableTypes[key];
  if (!declaredType) {
    return null;
  }

  const expectedType = normalizeExpectedType(declaredType);
  const actualType = inferValueType(rawValue);

  if (!isTypeCompatible(expectedType, actualType)) {
    return `vars.${key} must be ${expectedType}, got ${actualType}.`;
  }

  return null;
}

module.exports = {
  collectDeclaredVariablesWithTypes,
  validateVarsEntryType,
};
