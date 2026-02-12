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

const SAMPLE_HCL_WITH_TLS = `
env "prod" {
  url = "https://default:password@localhost:8443/default"

  tls {
    ca_file = env("TLS_CA_FILE")
    cert_file = "certs/client.pem"
    key_file = "certs/client.key"
  }

  migrations {
    dir = "migrations"
  }
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

test("parseConfig resolves TLS block and validates mTLS fields", async () => {
  const config = await parseConfig(
    SAMPLE_HCL_WITH_TLS,
    {
      TLS_CA_FILE: "certs/ca.pem",
    },
    {},
    "prod",
  );

  assert.equal(config.tls?.ca_file, "certs/ca.pem");
  assert.equal(config.tls?.cert_file, "certs/client.pem");
  assert.equal(config.tls?.key_file, "certs/client.key");
});

test("parseConfig throws when only one mTLS file is provided", async () => {
  await assert.rejects(
    () =>
      parseConfig(
        `
env "prod" {
  url = "https://default:password@localhost:8443/default"

  tls {
    ca_file = "certs/ca.pem"
    cert_file = "certs/client.pem"
  }

  migrations {
    dir = "migrations"
  }
}
`,
        {},
        {},
        "prod",
      ),
    /requires both cert_file and key_file/,
  );
});
