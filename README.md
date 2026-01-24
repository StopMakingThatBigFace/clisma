# 💊 clisma

**A ClickHouse migrations CLI with templated SQL and environment-aware config.**

<small>_"clisma" is a mashup of ClickHouse + Prisma. A dumb pun, but it stuck._</small>

This project borrows ideas from tools we like:

- **[Atlas](https://atlasgo.io/)** for the idea of [templated migrations](https://atlasgo.io/concepts/migrations#template) and [config-driven environments](https://atlasgo.io/concepts/dev-database).

- **[Prisma](https://www.prisma.io/)** for the simple, friendly CLI experience.

### So why it exists?

- **Templates in migrations** — Atlas has this, but it is paid; clisma keeps it simple and open.
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
  cluster_name = "prod-cluster"

  migrations {
    dir = "migrations"
    vars = {
      is_replicated = true
      create_table_options = "ON CLUSTER prod-cluster"
      ttl_days = var.ttl_days
    }
  }
}
```

**`cluster_name`** affects how the migrations tracking table is created (replicated or not). And the CLI will warn if the actual cluster does not match the config.

#### If your ClickHouse server has clusters configured, `cluster_name` is required

## 🧪 Templates

Templates are [Handlebars](https://handlebarsjs.com/guide/expressions.html). Variables come from `migrations.vars` (and
`cluster_name` is available as `{{cluster_name}}`).

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
