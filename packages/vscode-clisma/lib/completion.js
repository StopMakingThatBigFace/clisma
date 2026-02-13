const vscode = require("vscode");
const { ROOT_BLOCKS, BLOCK_FIELDS, NESTED_BLOCKS } = require("./schema-rules");
const { isInsideString } = require("./text");
const { getScopeStackAtPosition, currentBlock } = require("./parser-context");
const { collectDeclaredVariablesWithTypes } = require("./variables");

function makeSnippetItem(label, detail, insertText) {
  const item = new vscode.CompletionItem(
    label,
    vscode.CompletionItemKind.Snippet,
  );
  item.detail = detail;
  item.insertText = new vscode.SnippetString(insertText);
  return item;
}

function makePropertyItem(name) {
  const item = new vscode.CompletionItem(
    name,
    vscode.CompletionItemKind.Property,
  );
  item.insertText = new vscode.SnippetString(`${name} = $1`);
  item.detail = "Property";
  return item;
}

function makeKeywordItem(name) {
  const item = new vscode.CompletionItem(
    name,
    vscode.CompletionItemKind.Keyword,
  );
  item.insertText = new vscode.SnippetString(`${name} {\n  $1\n}`);
  item.detail = "Block";
  return item;
}

function provideVarsKeyCompletions(document, linePrefix, scopeStack) {
  const top = scopeStack[scopeStack.length - 1];
  if (
    !(
      top &&
      top.kind === "map" &&
      top.mapName === "vars" &&
      top.parentBlock === "migrations"
    )
  ) {
    return [];
  }

  const keyMatch = linePrefix.match(/^\s*([a-zA-Z_][\w-]*)?$/);
  if (!keyMatch) {
    return [];
  }

  const typedPrefix = keyMatch[1] || "";
  const declaredNames = Object.keys(
    collectDeclaredVariablesWithTypes(document),
  );

  return declaredNames
    .filter((name) => name.startsWith(typedPrefix))
    .map((name) => {
      const item = new vscode.CompletionItem(
        name,
        vscode.CompletionItemKind.Variable,
      );
      item.insertText = new vscode.SnippetString(`${name} = $1`);
      item.detail = "Variable Key";
      return item;
    });
}

function provideValueCompletions(linePrefix) {
  const items = [];

  if (/\btype\s*=\s*"?[a-z_]*$/i.test(linePrefix)) {
    for (const t of ["string", "number", "bool", "any"]) {
      const item = new vscode.CompletionItem(
        t,
        vscode.CompletionItemKind.EnumMember,
      );
      item.insertText = t;
      items.push(item);
    }
  }

  if (/\bis_replicated\s*=\s*[a-z]*$/i.test(linePrefix)) {
    for (const v of ["true", "false"]) {
      const item = new vscode.CompletionItem(
        v,
        vscode.CompletionItemKind.Value,
      );
      item.insertText = v;
      items.push(item);
    }
  }

  if (/\s=\s*[a-z_]+$/i.test(linePrefix)) {
    items.push(
      makeSnippetItem(
        'env("...")',
        "Read from environment",
        'env("${1:NAME}")',
      ),
    );
  }

  return items;
}

function provideContextCompletions(document, position) {
  const linePrefix = document
    .lineAt(position)
    .text.slice(0, position.character);

  if (isInsideString(linePrefix)) {
    return [];
  }

  const scopeStack = getScopeStackAtPosition(document, position);
  const varsKeyItems = provideVarsKeyCompletions(
    document,
    linePrefix,
    scopeStack,
  );
  if (varsKeyItems.length > 0) {
    return varsKeyItems;
  }

  const current = currentBlock(scopeStack);
  const items = [];

  items.push(...provideValueCompletions(linePrefix));

  if (!current) {
    for (const block of ROOT_BLOCKS) {
      items.push(
        makeSnippetItem(
          `${block} "..."`,
          "Top-level Clisma block",
          `${block} "\${1:name}" {\n  $2\n}`,
        ),
      );
    }
    return items;
  }

  for (const field of BLOCK_FIELDS[current] || []) {
    items.push(makePropertyItem(field));
  }

  for (const block of NESTED_BLOCKS[current] || []) {
    items.push(makeKeywordItem(block));
  }

  return items;
}

module.exports = {
  provideContextCompletions,
};
