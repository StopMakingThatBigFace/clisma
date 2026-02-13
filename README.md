# 💊 clisma

[![NPM Version](https://img.shields.io/npm/v/clisma?labelColor=EE4B2B&color=FFBF00&style=badge)](https://www.npmjs.com/package/clisma)

**A ClickHouse migrations CLI with templated SQL and environment-aware config.**

[![NPM Version](https://img.shields.io/npm/v/clisma?labelColor=EE4B2B&color=FFBF00&style=badge)](https://www.npmjs.com/package/clisma) [![Visual Studio Marketplace](https://img.shields.io/badge/Visual_Studio_Marketplace-Extension-blue?labelColor=black&color=white&style=badge)](https://marketplace.visualstudio.com/items?itemName=StopMakingThatBigFace.vscode-clisma)

### 💅 [See full Docs →](https://clisma.poorquality.tech/)

## What is for?

- **Templates in migrations** — like in Atlas, but free.
- **Multi-statement migrations** — write real SQL without splitting into tiny files.
- **Declarative environments** — keep local/staging/prod configs in one place.

## 📦 How to use it

### Global installation

```bash
npm install -g clisma
```

### NPM

```bash
npm install --save-dev clisma
```

### NPX

```bash
npx clisma
```

## 🚀 Quickstart

Create `clisma.hcl`:

```hcl
env "local" {
  url = "http://default:password@localhost:8123/mydb"

  migrations {
    dir = "migrations"
  }
}
```

Run migrations:

```bash
clisma run --env local
clisma status --env local
```

## 🧩 Config basics

- `env "name"` defines an environment.
- `migrations` holds migration settings.
- `variable "name"` defines inputs for `var.*`.
- `env("NAME")` reads environment variables.

### Example with variables and templates

```hcl
variable "ttl_days" {
  type = string
  default = "30"
}

env "production" {
  url = env("CLICKHOUSE_PROD_URL")

  migrations {
    dir = "migrations"

    table {
      name = "schema_migrations"

      is_replicated = true

      # Optional: force a specific cluster for ON CLUSTER.
      cluster_name = "prod-cluster"

      # If replication_path is set, is_replicated can be omitted.
      replication_path = "/clickhouse/tables/cluster-{cluster}/shard-{shard}/{database}/schema_migrations"
    }

    vars = {
      is_replicated = true
      create_table_options = "ON CLUSTER prod-cluster"
      ttl_days = var.ttl_days
    }
  }
}
```

**`migrations.table`** controls the tracking table:

- `name` sets a custom table name.
- `is_replicated = true` enables replicated tracking.
- `cluster_name` optionally selects cluster for `ON CLUSTER`.
- `replication_path` overrides the default replication path (and also enables replicated mode if `is_replicated` is omitted).

### TLS certificates (custom CA and mTLS)

If your ClickHouse endpoint uses a self-signed certificate, add a `tls` block so clisma can trust your CA.

```hcl
env "production" {
  url = env("CLICKHOUSE_URL") # e.g. https://user:pass@host:8443/db

  tls {
    ca_file = env("CLICKHOUSE_CA_FILE")
    # cert_file = env("CLICKHOUSE_CLIENT_CERT_FILE") # optional, for mTLS
    # key_file  = env("CLICKHOUSE_CLIENT_KEY_FILE")  # optional, for mTLS
  }

  ...
}
```

Notes:

- `ca_file` is required when `tls` is set.
- `cert_file` and `key_file` must be provided together.
- Relative paths are resolved from the directory where `clisma.hcl` lives.

## 🧪 Templates

Templates are [Handlebars](https://handlebarsjs.com/guide/expressions.html). Variables come from `migrations.vars`.

```sql
CREATE TABLE IF NOT EXISTS events {{create_table_options}} (
  id UUID,
  created_at DateTime DEFAULT now()
)
{{#if is_replicated}}
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{cluster}/events', '{replica}')
{{else}}
ENGINE = MergeTree()
{{/if}}
ORDER BY id;
```

Multi-statement migrations are supported (split on semicolons outside strings/comments).

## 🛠️ CLI

Common commands:

```bash
clisma run --env local
clisma status --env local
clisma create --name create_events
clisma checksum ./migrations/20240101123045_create_events.sql
```

### Additional flags

- `--config <path>`
- `--env <name>`
- `--env-file <path>`
- `--var <key=value>` (repeatable)

The CLI requires a config file. Use `--config` or place `clisma.hcl` in the current directory.

Example with variables and env file:

```bash
clisma run --env local --var ttl_days=30 --env-file .env
```

## Summary

This project borrows ideas from tools we like:

- **[Atlas](https://atlasgo.io/)** for the idea of [templated migrations](https://atlasgo.io/concepts/migrations#template) and [config-driven environments](https://atlasgo.io/concepts/dev-database).

- **[Prisma](https://www.prisma.io/)** for the simple, friendly CLI experience.

<small>_"clisma" is a mashup of ClickHouse + Prisma. A dumb pun, but it stuck._ 👉👈</small>
