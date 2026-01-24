import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../config.js";

const SAMPLE_HCL = `
env "local" {
  url = env("CLICKHOUSE_URL")

  migrations {
    dir = "migrations/\${var.ttl_days}"

    vars = {
      ttl = var.ttl_days
      ttl_static = "var.ttl_days"
      ttl_unexisting = var.non_existing_var
    }
  }
}

variable "ttl_days" {
  type = string
  default = "30"
}
`;

test("parseConfig resolves env() and var.* values", async () => {
  const config = await parseConfig(
    SAMPLE_HCL,
    {
      CLICKHOUSE_URL: "lol",
    },
    {},
    "local",
  );

  assert.equal(config.url, "lol");
  assert.equal(config.migrations.dir, "migrations/30");
  assert.equal(config.migrations.vars?.ttl, "30");
  assert.equal(config.migrations.vars?.ttl_static, "var.ttl_days");
  assert.equal(config.migrations.vars?.ttl_unexisting, "");
});
