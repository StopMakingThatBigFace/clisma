#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const outPath = path.resolve(__dirname, '../generated/schema-rules.json');

function refToDefName(ref) {
  if (!ref || typeof ref !== 'string') return '';
  const parts = ref.split('/');
  return parts[parts.length - 1] || '';
}

function fieldTypeFromProperty(prop) {
  if (!prop || typeof prop !== 'object') {
    return null;
  }

  if (prop.$ref === '#/$defs/variableValue') {
    return { kind: 'field', type: 'any' };
  }

  if (typeof prop.type === 'string') {
    if (prop.type === 'boolean' || prop.type === 'string' || prop.type === 'number') {
      return { kind: 'field', type: prop.type };
    }
    if (prop.type === 'object') {
      return { kind: 'field', type: 'object' };
    }
    if (prop.type === 'array') {
      if (prop.items && typeof prop.items === 'object' && prop.items.$ref) {
        return {
          kind: 'nested-block',
          defName: refToDefName(prop.items.$ref),
        };
      }
      return { kind: 'field', type: 'array' };
    }
  }

  if (Array.isArray(prop.type)) {
    if (prop.type.includes('array')) {
      return { kind: 'field', type: 'array' };
    }
    if (prop.type.includes('object')) {
      return { kind: 'field', type: 'object' };
    }
  }

  return null;
}

function deriveRules(schema) {
  const defs = schema.$defs || {};
  const rootProperties = schema.properties || {};

  const rules = {
    version: 1,
    rootBlocks: [],
    blocks: {},
    variableTypeEnum: [],
  };

  const defNameToBlockName = {};

  for (const [rootName, prop] of Object.entries(rootProperties)) {
    const blockRef = prop?.additionalProperties?.items?.$ref;
    const defName = refToDefName(blockRef);
    if (!defName) continue;

    rules.rootBlocks.push(rootName);
    defNameToBlockName[defName] = rootName;
    rules.blocks[rootName] = {
      fields: [],
      fieldTypes: {},
      requiredFields: [],
      nestedBlocks: [],
    };
  }

  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    for (const knownBlockName of Object.keys(rules.blocks)) {
      const currentDefName = Object.keys(defNameToBlockName).find(
        (def) => defNameToBlockName[def] === knownBlockName,
      );
      const def = defs[currentDefName];
      if (!def) continue;

      const properties = def.properties || {};
      for (const [propName, propSchema] of Object.entries(properties)) {
        const analyzed = fieldTypeFromProperty(propSchema);
        if (!analyzed || analyzed.kind !== 'nested-block') continue;

        const nestedDefName = analyzed.defName;
        if (!nestedDefName) continue;

        if (!defNameToBlockName[nestedDefName]) {
          defNameToBlockName[nestedDefName] = propName;
          if (!rules.blocks[propName]) {
            rules.blocks[propName] = {
              fields: [],
              fieldTypes: {},
              requiredFields: [],
              nestedBlocks: [],
            };
            madeProgress = true;
          }
        }
      }
    }
  }

  for (const [defName, blockName] of Object.entries(defNameToBlockName)) {
    const def = defs[defName];
    if (!def || !rules.blocks[blockName]) continue;

    const properties = def.properties || {};
    const required = Array.isArray(def.required) ? def.required : [];
    rules.blocks[blockName].requiredFields = required;

    for (const [propName, propSchema] of Object.entries(properties)) {
      const analyzed = fieldTypeFromProperty(propSchema);
      if (!analyzed) continue;

      if (analyzed.kind === 'nested-block') {
        const nestedBlockName = defNameToBlockName[analyzed.defName] || propName;
        if (!rules.blocks[blockName].nestedBlocks.includes(nestedBlockName)) {
          rules.blocks[blockName].nestedBlocks.push(nestedBlockName);
        }
      } else {
        if (!rules.blocks[blockName].fields.includes(propName)) {
          rules.blocks[blockName].fields.push(propName);
        }
        rules.blocks[blockName].fieldTypes[propName] = analyzed.type;
      }

      if (blockName === 'variable' && propName === 'type' && Array.isArray(propSchema.enum)) {
        rules.variableTypeEnum = propSchema.enum.slice();
      }
    }
  }

  return rules;
}

async function loadSchemaFromConfigPackage() {
  const candidates = [
    '@clisma/config/dist/index.js',
    '@clisma/config/dist/hcl-schema.js',
    '@clisma/config',
  ];

  let lastError = '';

  for (const specifier of candidates) {
    try {
      const mod = await import(specifier);
      if (mod.clismaSchema) {
        return mod.clismaSchema;
      }
      if (typeof mod.generateSchema === 'function') {
        return mod.generateSchema();
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  try {
    const mod = await import('@clisma/config');
    if (mod?.default?.clismaSchema) return mod.default.clismaSchema;
    if (typeof mod?.default?.generateSchema === 'function') return mod.default.generateSchema();
  } catch (error) {
    if (!lastError) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(
    `Unable to import schema from @clisma/config (built package). Build it first (npm run -w packages/config build). Details: ${lastError || 'schema export not found'}`,
  );
}

async function main() {
  const schema = await loadSchemaFromConfigPackage();
  const rules = deriveRules(schema);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(rules, null, 2)}\n`);
  process.stdout.write(`Generated ${outPath}\n`);
}

main().catch((error) => {
  const details = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${details}\n`);
  process.exit(1);
});
