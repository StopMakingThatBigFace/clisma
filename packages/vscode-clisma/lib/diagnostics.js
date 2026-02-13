const path = require("node:path");
const vscode = require("vscode");
const { parse } = require("../vendor/node_modules/@cdktf/hcl2json");
const {
  ROOT_BLOCKS,
  BLOCK_FIELDS,
  FIELD_TYPES,
  REQUIRED_FIELDS,
  NESTED_BLOCKS,
  KNOWN_BLOCK_SET,
  VARIABLE_TYPE_ENUM,
} = require("./schema-rules");
const {
  inferValueType,
  isTypeCompatible,
  normalizeExpectedType,
} = require("./types");

function isClismaDocument(document) {
  if (document.languageId === "clisma") return true;
  const fileName = path.basename(document.fileName);
  return fileName === "clisma.hcl" || fileName.endsWith(".clisma");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTokenRange(document, token, fallbackLine = 0) {
  const escaped = escapeRegExp(token);
  const keyRegex = new RegExp(`^\\s*${escaped}\\s*=`);
  const wordRegex = new RegExp(`\\b${escaped}\\b`);

  const tryLine = (lineNumber) => {
    if (lineNumber < 0 || lineNumber >= document.lineCount) return null;
    const text = document.lineAt(lineNumber).text;
    if (keyRegex.test(text)) {
      const idx = text.indexOf(token);
      if (idx !== -1) {
        return new vscode.Range(
          new vscode.Position(lineNumber, idx),
          new vscode.Position(lineNumber, idx + token.length),
        );
      }
    }
    if (wordRegex.test(text)) {
      const idx = text.search(wordRegex);
      if (idx !== -1) {
        return new vscode.Range(
          new vscode.Position(lineNumber, idx),
          new vscode.Position(lineNumber, idx + token.length),
        );
      }
    }
    return null;
  };

  const preferred = tryLine(fallbackLine);
  if (preferred) {
    return preferred;
  }

  for (let i = fallbackLine; i < document.lineCount; i += 1) {
    const found = tryLine(i);
    if (found) {
      return found;
    }
  }

  for (let i = 0; i < fallbackLine; i += 1) {
    const found = tryLine(i);
    if (found) {
      return found;
    }
  }

  for (let i = 0; i < document.lineCount; i += 1) {
    const text = document.lineAt(i).text;
    const idx = text.indexOf(token);
    if (idx !== -1) {
      return new vscode.Range(
        new vscode.Position(i, idx),
        new vscode.Position(i, idx + token.length),
      );
    }
  }

  return new vscode.Range(
    new vscode.Position(fallbackLine, 0),
    new vscode.Position(fallbackLine, 1),
  );
}

function makeDiagnostic(document, token, message, fallbackLine = 0) {
  return new vscode.Diagnostic(
    findTokenRange(document, token, fallbackLine),
    message,
    vscode.DiagnosticSeverity.Error,
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeVariableTypeLiteral(value) {
  if (typeof value !== "string") {
    return "";
  }

  if (VARIABLE_TYPE_ENUM.has(value)) {
    return value;
  }

  const interpolation = value.match(/^\$\{([a-z_][\w-]*)\}$/i);
  if (!interpolation) {
    return "";
  }

  const candidate = interpolation[1];
  return VARIABLE_TYPE_ENUM.has(candidate) ? candidate : "";
}

function validateType(
  document,
  diagnostics,
  token,
  value,
  expectedType,
  fallbackLine,
) {
  const actualType = inferValueType(
    typeof value === "string" ? JSON.stringify(value) : String(value),
  );

  if (expectedType === "any") {
    return;
  }

  let compatible = false;
  if (expectedType === "string") compatible = typeof value === "string";
  if (expectedType === "number") compatible = typeof value === "number";
  if (expectedType === "boolean") compatible = typeof value === "boolean";
  if (expectedType === "array") compatible = Array.isArray(value);
  if (expectedType === "object") compatible = isPlainObject(value);

  if (!compatible) {
    diagnostics.push(
      makeDiagnostic(
        document,
        token,
        `Property "${token}" must be ${expectedType}, got ${actualType}.`,
        fallbackLine,
      ),
    );
  }
}

function collectDeclaredVariableTypes(parsed) {
  const result = {};
  const varsRoot = parsed.variable;
  if (!isPlainObject(varsRoot)) return result;

  for (const [name, blocks] of Object.entries(varsRoot)) {
    const block = Array.isArray(blocks) ? blocks[0] : null;
    if (!isPlainObject(block)) continue;

    const resolvedType = normalizeVariableTypeLiteral(block.type);
    if (resolvedType) {
      result[name] = resolvedType;
    }
  }

  return result;
}

function validateVariableBlock(document, diagnostics, varName, block, fallbackLine) {
  const required = REQUIRED_FIELDS.variable || [];
  for (const field of required) {
    if (!(field in block)) {
      diagnostics.push(
        makeDiagnostic(
          document,
          varName,
          `variable "${varName}" is missing required "${field}".`,
          fallbackLine,
        ),
      );
    }
  }

  if ("type" in block) {
    const resolvedType = normalizeVariableTypeLiteral(block.type);
    if (!resolvedType) {
      diagnostics.push(
        makeDiagnostic(
          document,
          "type",
          "variable.type must be one of: string, number, bool, any.",
          fallbackLine,
        ),
      );
    } else if ("default" in block) {
      const expected = normalizeExpectedType(resolvedType);
      const actual = inferValueType(
        typeof block.default === "string"
          ? JSON.stringify(block.default)
          : String(block.default),
      );
      if (!isTypeCompatible(expected, actual)) {
        diagnostics.push(
          makeDiagnostic(
            document,
            "default",
            `default is not compatible with variable.type "${resolvedType}".`,
            fallbackLine,
          ),
        );
      }
    }
  }
}

function validateMigrationsVars(
  document,
  diagnostics,
  block,
  declaredVariableTypes,
  fallbackLine,
) {
  if (!("vars" in block) || !isPlainObject(block.vars)) return;

  for (const [key, value] of Object.entries(block.vars)) {
    const declared = declaredVariableTypes[key];
    if (!declared) continue;

    const expected = normalizeExpectedType(declared);
    const actual = inferValueType(
      typeof value === "string" ? JSON.stringify(value) : String(value),
    );
    if (!isTypeCompatible(expected, actual)) {
      diagnostics.push(
        makeDiagnostic(
          document,
          key,
          `vars.${key} must be ${expected}, got ${actual}.`,
          fallbackLine,
        ),
      );
    }
  }
}

function validateBlock(
  document,
  diagnostics,
  blockName,
  blockObj,
  declaredVariableTypes,
  blockToken,
  blockLineHint = 0,
) {
  if (!KNOWN_BLOCK_SET.has(blockName)) {
    diagnostics.push(
      makeDiagnostic(document, blockName, `Unknown block "${blockName}".`, blockLineHint),
    );
    return;
  }

  const fields = BLOCK_FIELDS[blockName] || [];
  const nestedBlocks = NESTED_BLOCKS[blockName] || [];
  const required = REQUIRED_FIELDS[blockName] || [];

  for (const field of required) {
    if (!(field in blockObj)) {
      diagnostics.push(
        makeDiagnostic(
          document,
          blockToken,
          `${blockName} "${blockToken}" is missing required "${field}".`,
          blockLineHint,
        ),
      );
    }
  }

  for (const key of Object.keys(blockObj)) {
    if (!fields.includes(key) && !nestedBlocks.includes(key)) {
      diagnostics.push(
        makeDiagnostic(
          document,
          key,
          `Unknown property "${key}" in block "${blockName}".`,
          blockLineHint,
        ),
      );
      continue;
    }

    if (fields.includes(key)) {
      const expectedType = FIELD_TYPES[blockName]?.[key];
      if (expectedType) {
        validateType(
          document,
          diagnostics,
          key,
          blockObj[key],
          expectedType,
          blockLineHint,
        );
      }
    }

    if (nestedBlocks.includes(key)) {
      const value = blockObj[key];
      if (!Array.isArray(value)) {
        diagnostics.push(
          makeDiagnostic(
            document,
            key,
            `Block "${key}" in "${blockName}" must be a block/list.`,
            blockLineHint,
          ),
        );
      }
    }
  }

  if (blockName === "variable") {
    validateVariableBlock(document, diagnostics, blockToken, blockObj, blockLineHint);
  }

  if (blockName === "migrations") {
    validateMigrationsVars(
      document,
      diagnostics,
      blockObj,
      declaredVariableTypes,
      blockLineHint,
    );
  }

  for (const nestedName of nestedBlocks) {
    const nestedValue = blockObj[nestedName];
    if (!Array.isArray(nestedValue)) continue;

    for (const nestedBlock of nestedValue) {
      if (!isPlainObject(nestedBlock)) continue;
      validateBlock(
        document,
        diagnostics,
        nestedName,
        nestedBlock,
        declaredVariableTypes,
        nestedName,
        blockLineHint,
      );
    }
  }
}

function findRootBlockLine(document, rootBlock, name, occurrenceIndex) {
  const escapedName = escapeRegExp(name);
  const regex = new RegExp(`^\\s*${rootBlock}\\s+"${escapedName}"\\s*\\{`);
  let seen = 0;

  for (let i = 0; i < document.lineCount; i += 1) {
    const text = document.lineAt(i).text;
    if (regex.test(text)) {
      if (seen === occurrenceIndex) {
        return i;
      }
      seen += 1;
    }
  }

  return 0;
}

async function validateDocument(document, diagnosticsCollection) {
  try {
    if (!isClismaDocument(document)) {
      diagnosticsCollection.delete(document.uri);
      return;
    }

    const sourceName = path.basename(document.fileName) || "clisma.hcl";
    const parsed = await parse(sourceName, document.getText());
    const diagnostics = [];
    const root = isPlainObject(parsed) ? parsed : {};

    for (const rootKey of Object.keys(root)) {
      if (!ROOT_BLOCKS.includes(rootKey)) {
        diagnostics.push(
          makeDiagnostic(document, rootKey, `Unknown root block "${rootKey}".`),
        );
      }
    }

    const declaredVariableTypes = collectDeclaredVariableTypes(root);

    for (const rootBlock of ROOT_BLOCKS) {
      const rootValue = root[rootBlock];
      if (rootValue === undefined) continue;

      if (!isPlainObject(rootValue)) {
        diagnostics.push(
          makeDiagnostic(
            document,
            rootBlock,
            `Root block "${rootBlock}" must be named blocks.`,
          ),
        );
        continue;
      }

      for (const [name, blocks] of Object.entries(rootValue)) {
        if (!Array.isArray(blocks)) {
          diagnostics.push(
            makeDiagnostic(
              document,
              name,
              `Block "${rootBlock} \"${name}\"" must be a list.`,
            ),
          );
          continue;
        }

        for (let i = 0; i < blocks.length; i += 1) {
          const blockObj = blocks[i];
          if (!isPlainObject(blockObj)) continue;
          const blockLineHint = findRootBlockLine(document, rootBlock, name, i);
          validateBlock(
            document,
            diagnostics,
            rootBlock,
            blockObj,
            declaredVariableTypes,
            name,
            blockLineHint,
          );
        }
      }
    }

    diagnosticsCollection.set(document.uri, diagnostics);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback = new vscode.Diagnostic(
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)),
      `Clisma validator parse Error: ${message}`,
      vscode.DiagnosticSeverity.Warning,
    );
    diagnosticsCollection.set(document.uri, [fallback]);
  }
}

module.exports = {
  validateDocument,
  isClismaDocument,
};
