import test from "node:test";
import assert from "node:assert/strict";
import { calculateChecksum, splitStatements } from "../migrations/sql.js";

test("splitStatements handles basic semicolons", () => {
  const sql = "SELECT 1; SELECT 2;";
  const statements = splitStatements(sql);

  assert.deepEqual(statements, ["SELECT 1", "SELECT 2"]);
});

test("splitStatements ignores semicolons in strings and comments", () => {
  const sql = `
    -- comment with ;
    SELECT 'value;still_string';
    /* block ; comment */
    SELECT "value;still_string";
  `;
  const statements = splitStatements(sql);

  assert.equal(statements.length, 2);
  assert.ok(statements[0].includes("SELECT 'value;still_string'"));
  assert.ok(statements[1].includes('SELECT "value;still_string"'));
});

test("calculateChecksum returns stable sha256", () => {
  const checksum = calculateChecksum("hello");

  assert.equal(
    checksum,
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
  );
});
