# Clisma VS Code Extension

Syntax highlighting and context-aware autocomplete for Clisma schema files.

> Warning: this extension implementation was generated with AI assistance and has not been fully manually audited. I have no idea how this works.

## File matching

The extension activates for:

- `clisma.hcl`
- `*.clisma`

## Features

- Clisma-aware syntax highlighting for blocks and fields:
  - Blocks: `env`, `variable`, `migrations`, `table`, `tls`
  - Properties: `url`, `exclude`, `dir`, `vars`, `name`, `is_replicated`, `cluster_name`, `replication_path`, `ca_file`, `cert_file`, `key_file`, `type`, `default`, `description`
- Snippet-based autocomplete for common Clisma structures:
  - `env`
  - `variable`
  - `migrations`
  - `tls`
  - `table`
  - property snippets (`url`, `dir`, `exclude`, `vars`)
- Context-aware suggestions:
  - top-level block suggestions: `env`, `variable`
  - block-aware fields inside `env`, `migrations`, `table`, `tls`, `variable`
  - value suggestions for:
    - `type = ...` -> `string`, `number`, `bool`, `any`
    - `is_replicated = ...` -> `true`, `false`
    - expression helper `env("...")`
  - key suggestions inside `migrations.vars = {}` from declared `variable "name"` blocks
- Live diagnostics:
  - unknown properties in known blocks are marked as errors
  - unknown blocks or blocks in wrong nesting level are marked as errors
  - `variable` requires `type`
  - `variable.default` is validated against `variable.type`
  - for keys in `migrations.vars` that match declared variables, value type is validated against declared `variable.type`
  - custom keys in `migrations.vars` stay allowed without schema binding

## Local development

1. Open `packages/vscode-clisma`.
2. Press `F5` to run Extension Development Host.
3. Open any `clisma.hcl` or `*.clisma` file and test highlighting/completions.

Schema-derived rules are generated from `packages/config/src/hcl-schema.ts`:

```bash
npm run generate:rules -w packages/vscode-clisma
```

## Publish to VS Code Marketplace

```bash
npx @vscode/vsce login <your-publisher>
```

1. Publish:

```bash
npm run publish:marketplace
```

## Package `.vsix`

```bash
npm run package -w packages/vscode-clisma
```

This creates a `.vsix` package that can be installed manually.
