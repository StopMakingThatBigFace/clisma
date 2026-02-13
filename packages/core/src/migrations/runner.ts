import { createClient, type ClickHouseClient } from "@clickhouse/client";
import ora from "ora";
import kleur from "kleur";
import os from "node:os";
import type { MigrationCommand, MigrationRunnerOptions } from "./types.js";
import { splitStatements } from "./sql.js";
import { renderTemplate } from "./template.js";
import { MigrationRepository } from "./repository.js";
import { resolvePackageVersion } from "../utils.js";

const resolveAppliedBy = (): string => {
  try {
    return os.userInfo().username || process.env.USER || "";
  } catch {
    return process.env.USER || "";
  }
};

const resolveCliVersion = (): Promise<string> =>
  resolvePackageVersion(import.meta.url, "../../package.json");

export class MigrationRunner {
  #client: ClickHouseClient;
  #repository: MigrationRepository;
  #tableName: string;
  #isReplicated: boolean;
  #clusterName?: string;
  #replicationPath?: string;
  #tls?: MigrationRunnerOptions["tls"];
  #templateVars: MigrationRunnerOptions["templateVars"];
  #initialized = false;

  constructor(options: MigrationRunnerOptions) {
    const url = new URL(options.connectionString);

    if (!url.username) {
      throw new Error("ClickHouse connection string must include username");
    }

    const database = url.pathname.replace("/", "");

    if (!database) {
      throw new Error(
        "ClickHouse connection string must include database name",
      );
    }

    this.#tableName = options.tableName || "schema_migrations";
    this.#isReplicated = options.isReplicated || false;
    this.#clusterName = options.clusterName;
    this.#replicationPath = options.replicationPath;
    this.#tls = options.tls;
    this.#templateVars = options.templateVars || {};

    const isMutualTls = Boolean(this.#tls?.cert && this.#tls?.key);
    const tls = this.#tls
      ? isMutualTls
        ? {
            ca_cert: this.#tls.caCert,
            cert: this.#tls.cert!,
            key: this.#tls.key!,
          }
        : {
            ca_cert: this.#tls.caCert,
          }
      : undefined;

    const clientUrl = `${url.protocol}//${url.host}${url.search}`;

    this.#client = createClient({
      url: clientUrl,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      tls,
      set_basic_auth_header: isMutualTls ? false : undefined,
    });

    this.#repository = new MigrationRepository({
      client: this.#client,
      migrationsDir: options.migrationsDir,
      tableName: this.#tableName,
      replicationPath: this.#replicationPath,
    });
  }

  async #initialize(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    const spinner = ora("Detecting cluster configuration...").start();

    try {
      const clusterName = await this.#repository.initialize(
        this.#isReplicated,
        this.#clusterName,
      );

      if (clusterName) {
        spinner.succeed(
          kleur.green(
            `Replicated mode enabled on cluster: ${kleur.bold(clusterName)}`,
          ),
        );
      } else {
        spinner.info("Using non-replicated mode");
      }

      this.#initialized = true;
    } catch (error) {
      spinner.fail("Failed to detect cluster configuration:");
      throw error;
    }
  }

  async run(): Promise<void> {
    await this.#initialize();
    await this.#repository.ensureMigrationsTable();

    const applied = await this.#repository.getAppliedMigrations();
    const { pending, error } =
      await this.#repository.getPendingMigrations(applied);

    if (error) {
      throw error;
    }

    if (pending.length === 0) {
      console.log("✓ No pending migrations");
      return;
    }

    console.log(
      kleur.bold(
        `\nFound ${kleur.yellow(pending.length)} pending migration(s):`,
      ),
    );

    pending.forEach((migration) =>
      console.log(kleur.dim(`  • ${migration.version}_${migration.name}`)),
    );

    console.log("");

    for (const migration of pending) {
      const spinner = ora(
        `Applying ${kleur.bold(migration.version)}_${migration.name}`,
      ).start();

      try {
        const sql = renderTemplate(migration.content, this.#templateVars);
        const statements = splitStatements(sql);

        for (const statement of statements) {
          await this.#client.command({
            query: statement,
          });
        }

        const cliVersion = await resolveCliVersion();

        await this.#client.insert({
          table: this.#tableName,
          values: [
            {
              version: migration.version,
              name: migration.name,
              checksum: migration.checksum,
              hostname: os.hostname(),
              applied_by: resolveAppliedBy(),
              cli_version: cliVersion,
            },
          ],
          format: "JSONEachRow",
        });

        spinner.succeed(
          kleur.green(
            `Applied ${kleur.bold(migration.version)}_${migration.name}`,
          ),
        );
      } catch (err) {
        spinner.fail(
          kleur.red(`Failed to apply ${migration.version}_${migration.name}:`),
        );
        throw err;
      }
    }

    console.log(
      kleur.bold(kleur.green("\n✓ All migrations applied successfully")),
    );
  }

  async status(): Promise<void> {
    await this.#initialize();
    await this.#repository.ensureMigrationsTable();

    const applied = await this.#repository.getAppliedMigrations();
    const { pending, error } =
      await this.#repository.getPendingMigrations(applied);

    if (error) {
      throw error;
    }

    console.log("");
    console.log(kleur.bold("Migration Status"));
    console.log(
      `  ${kleur.green("Applied:")} ${kleur.bold(applied.size.toString())}`,
    );
    console.log(
      `  ${kleur.yellow("Pending:")} ${kleur.bold(pending.length.toString())}`,
    );
    console.log("");

    if (applied.size > 0) {
      console.log(kleur.bold("Applied migrations:"));
      Array.from(applied.values())
        .sort((a, b) => a.version.localeCompare(b.version))
        .forEach((migration) =>
          console.log(
            kleur.dim(`  ✓ ${migration.version}_${migration.name}`) +
              kleur.gray(` (${migration.applied_at})`),
          ),
        );
      console.log("");
    }

    if (pending.length > 0) {
      console.log(kleur.bold("Pending migrations:"));
      pending.forEach((migration) =>
        console.log(
          kleur.yellow(`  ⏳ ${migration.version}_${migration.name}`),
        ),
      );
      console.log("");
    }
  }

  async close(): Promise<void> {
    await this.#client.close();
  }
}

export const runMigrations = async (
  options: MigrationRunnerOptions,
  command: MigrationCommand,
): Promise<void> => {
  const runner = new MigrationRunner(options);

  try {
    if (command === "status") {
      await runner.status();
    } else {
      await runner.run();
    }
  } finally {
    await runner.close();
  }
};
