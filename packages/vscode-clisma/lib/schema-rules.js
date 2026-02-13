const rules = require('../generated/schema-rules.json');

const ROOT_BLOCKS = rules.rootBlocks;
const BLOCK_FIELDS = Object.fromEntries(
  Object.entries(rules.blocks).map(([name, meta]) => [name, meta.fields || []]),
);
const FIELD_TYPES = Object.fromEntries(
  Object.entries(rules.blocks).map(([name, meta]) => [name, meta.fieldTypes || {}]),
);
const REQUIRED_FIELDS = Object.fromEntries(
  Object.entries(rules.blocks).map(([name, meta]) => [name, meta.requiredFields || []]),
);
const NESTED_BLOCKS = Object.fromEntries(
  Object.entries(rules.blocks).map(([name, meta]) => [name, meta.nestedBlocks || []]),
);
const KNOWN_BLOCKS = Object.keys(rules.blocks);
const KNOWN_BLOCK_SET = new Set(KNOWN_BLOCKS);
const VARIABLE_TYPE_ENUM = new Set(rules.variableTypeEnum || []);

module.exports = {
  ROOT_BLOCKS,
  BLOCK_FIELDS,
  FIELD_TYPES,
  REQUIRED_FIELDS,
  NESTED_BLOCKS,
  KNOWN_BLOCKS,
  KNOWN_BLOCK_SET,
  VARIABLE_TYPE_ENUM,
};
