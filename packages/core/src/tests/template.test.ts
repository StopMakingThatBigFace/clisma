import test from "node:test";
import assert from "node:assert/strict";
import { renderTemplate } from "../migrations/template.js";

test("renderTemplate keeps SQL quotes in templated options", () => {
  const sql = "CREATE TABLE t {{create_table_options}} (id UInt8)";

  const rendered = renderTemplate(sql, {
    create_table_options: 'ON CLUSTER "default"',
  });

  assert.equal(rendered, 'CREATE TABLE t ON CLUSTER "default" (id UInt8)');
  assert.equal(rendered.includes("&quot;"), false);
});
