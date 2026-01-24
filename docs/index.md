---
title: clisma
---

Clisma is a ClickHouse migration tool with templating support and environment configuration.
Think of it as a tiny, pragmatic CLI for migrations with a bit of templating sugar.

Use the CLI for day-to-day workflows, or the core package for programmatic control.

## What it does

- Applies SQL migrations in order and tracks them in ClickHouse.
- Supports Handlebars templating with auto-detected cluster context.
- Reads environment-specific configuration from `clisma.hcl`.

## Inspiration

This project borrows ideas from tools we like:

- [Prisma](https://www.prisma.io/) for the simple, friendly CLI experience.
- [Atlas](https://atlasgo.io/) for the idea of templated migrations and config-driven environments.

For Atlas, the inspiration is templated migrations and environment config:

- [Templated migrations](https://atlasgo.io/concepts/migrations#template)
- [Environment configuration](https://atlasgo.io/concepts/dev-database)

> Why the weird name?
>
> It is a little joke: ClickHouse + Prisma -> clisma. There is no full schema
> management here (yet), but the vibe is similar.

## Next steps

- Install the CLI and run your first migration.
- Set up `clisma.hcl` with `migrations` and variables.
