const { VARIABLE_TYPE_ENUM } = require("./schema-rules");

function parseVariableTypeValue(rawValue) {
  const value = rawValue.trim();
  const quoted = value.match(/^"([^"]+)"/);
  const unquoted = value.match(/^([a-zA-Z_][\w-]*)/);
  const typeName = quoted ? quoted[1] : unquoted ? unquoted[1] : "";

  if (!typeName) {
    return { valid: false, typeName: "" };
  }

  return { valid: VARIABLE_TYPE_ENUM.has(typeName), typeName };
}

function inferValueType(rawValue) {
  const value = rawValue.trim();

  if (!value) return "unknown";
  if (value.startsWith('"')) return "string";
  if (value.startsWith("[")) return "array";
  if (value.startsWith("{")) return "object";
  if (/^(true|false)\b/.test(value)) return "boolean";
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?\b/.test(value)) return "number";
  if (/^env\s*\(/.test(value)) return "expression";
  return "unknown";
}

function isTypeCompatible(expected, actual) {
  if (expected === "any" || actual === "unknown") return true;
  if (expected === actual) return true;

  if (actual === "expression") {
    return (
      expected === "string" || expected === "number" || expected === "boolean"
    );
  }

  return false;
}

function normalizeExpectedType(typeName) {
  return typeName === "bool" ? "boolean" : typeName;
}

module.exports = {
  parseVariableTypeValue,
  inferValueType,
  isTypeCompatible,
  normalizeExpectedType,
};
