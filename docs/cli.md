---
title: CLI
---

Clisma ships a CLI for applying and inspecting migrations.

The CLI requires a config file. Use `--config` or place `clisma.hcl` in the current directory.

## Commands

### run

Apply pending migrations.

```bash
clisma run --env local
```

### status

Show applied and pending migrations.

```bash
clisma status --env local
```

### create

Create a new migration file.

```bash
clisma create --name create_users_table
```

If you omit `--name`, the CLI will prompt you.

Migration filenames use the `YYYYMMDDhhmmss_<name>.sql` format.

### checksum

Print the SHA-256 checksum for a migration file.

```bash
clisma checksum ./migrations/20240101123045_create_users.sql
```

## Flags

- **`--env <name>` — environment from config file.**

  Example: `--env production`

- **`--config <path>` — path to config file.**

  Example: `--config ./clisma.hcl`

- **`--var <key=value>` — set variable value (repeatable).**

  Example: `--var ttl_days=30 --var replication_factor=3`

- **`--env-file <path>` — load env vars from file.**
  
  Example: `--env-file .env`
