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

const SAMPLE_HCL_WITH_TABLE = `
env "prod" {
  url = "http://default:password@localhost:8123/default"

  migrations {
    dir = "migrations"

    table {
      name = "custom_migrations"
      is_replicated = true
      replication_path = "/clickhouse/some/path"
    }
  }
}
`;

const SAMPLE_HCL_WITH_ONLY_REPLICATION_PATH = `
env "prod" {
  url = "http://default:password@localhost:8123/default"

  migrations {
    dir = "migrations"

    table {
      replication_path = "/clickhouse/some/path"
    }
  }
}
`;

const SAMPLE_HCL_WITH_CLUSTER_NAME = `
env "prod" {
  url = "http://default:password@localhost:8123/default"

  migrations {
    dir = "migrations"

    table {
      cluster_name = "prod-cluster"
    }
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

test("parseConfig parses migrations.table block", async () => {
  const config = await parseConfig(SAMPLE_HCL_WITH_TABLE, {}, {}, "prod");

  assert.equal(config.migrations.table?.name, "custom_migrations");
  assert.equal(config.migrations.table?.is_replicated, true);
  assert.equal(
    config.migrations.table?.replication_path,
    "/clickhouse/some/path",
  );
});

test("parseConfig enables replication when replication_path is set", async () => {
  const config = await parseConfig(
    SAMPLE_HCL_WITH_ONLY_REPLICATION_PATH,
    {},
    {},
    "prod",
  );

  assert.equal(config.migrations.table?.is_replicated, true);
  assert.equal(
    config.migrations.table?.replication_path,
    "/clickhouse/some/path",
  );
});

test("parseConfig enables replication when cluster_name is set", async () => {
  const config = await parseConfig(SAMPLE_HCL_WITH_CLUSTER_NAME, {}, {}, "prod");

  assert.equal(config.migrations.table?.is_replicated, true);
  assert.equal(config.migrations.table?.cluster_name, "prod-cluster");
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
