---
title: Getting Started
---

clisma is a ClickHouse migration tool with templating support and environment configuration.

## Installation

```bash
npm install --save-dev clisma
```

Or install it globally:

```bash
npm install -g clisma
```

## Quickstart

### 1. Create a config

Create `clisma.hcl` in your project root:

```hcl
env "local" {
  url = "http://default:password@localhost:8123/mydb"

  migrations {
    dir = "migrations/clickhouse"
  }
}
```

### 2. Create your first migration

```bash
clisma create
```

### 3. Run it

```bash
clisma run --env local
```

### 4. Check status

```bash
clisma status --env local
```

You can also pass config variables and load environment files:

```bash
clisma run --env local --var ttl_days=30 --env-file .env
```
