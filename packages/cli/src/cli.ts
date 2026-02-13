#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Command } from "commander";
import { input } from "@inquirer/prompts";
import kleur from "kleur";
import {
  runMigrations,
  findConfigFile,
  resolvePackageVersion,
} from "@clisma/core";
import type { MigrationRunnerTLSOptions } from "@clisma/core";
import { listEnvironmentsFile, parseConfigFile } from "@clisma/config";
import { parse as parseDotenv } from "@dotenvx/dotenvx";

type CliOptions = {
  config?: string;
  env?: string;
  envFile?: string;
  var?: string[];
};

const program = new Command();
const cliVersion = await resolvePackageVersion(
  import.meta.url,
  "../package.json",
);

const withCommonOptions = (command: Command): void => {
  command
    .option("--config <path>", "Path to config file (default: clisma.hcl)")
    .option("--env <name>", "Environment name from config file")
    .option("--env-file <path>", "Load environment variables from file")
    .option(
      "--var <key=value>",
      "Set a variable value (can be used multiple times)",
      (value, previous: string[] = []) => {
        return [...previous, value];
      },
    );
};

const parseVars = (varArgs: string[] = []): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const arg of varArgs) {
    const [key, ...valueParts] = arg.split("=");
    if (key && valueParts.length > 0) {
      vars[key] = valueParts.join("=");
    }
  }
  return vars;
};

const parseEnvFile = async (
  filePath: string,
): Promise<Record<string, string | undefined>> => {
  const contents = await fs.readFile(filePath, "utf8");
  return parseDotenv(contents);
};

const resolveEnvName = async (
  configPath: string,
  envName?: string,
): Promise<string> => {
  if (envName) {
    return envName;
  }

  const environments = await listEnvironmentsFile(configPath);
  if (environments.length === 1) {
    return environments[0];
  }

  if (environments.length === 0) {
    throw new Error("No environments defined in config file");
  }

  throw new Error(
    `Multiple environments found (${environments.join(", ")}). ` +
      "Specify one with --env.",
  );
};

const resolveFromConfigPath = (
  configPath: string,
  filePath: string,
): string => {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(path.dirname(configPath), filePath);
};

const runCommand = async (
  command: "run" | "status",
  options: CliOptions,
): Promise<void> => {
  const baseCwd = process.env.INIT_CWD || process.cwd();
  const envOverrides = options.envFile
    ? await parseEnvFile(path.resolve(baseCwd, options.envFile))
    : undefined;
  let migrationsDir: string;
  let connectionString: string;
  let tableName: string | undefined;
  let isReplicated = false;
  let clusterName: string | undefined;
  let replicationPath: string | undefined;
  let tls: MigrationRunnerTLSOptions | undefined;
  let templateVars: Record<string, unknown> | undefined;

  const configPath = options.config
    ? path.resolve(baseCwd, options.config)
    : await findConfigFile(baseCwd);

  if (!configPath) {
    throw new Error(
      "Config file is required. Use --config or place clisma.hcl in the current directory.",
    );
  }

  const envName = await resolveEnvName(configPath, options.env);
  console.log(`  Config: ${kleur.bold(configPath)}`);
  const vars = parseVars(options.var);
  const envConfig = await parseConfigFile(
    configPath,
    envName,
    vars,
    envOverrides,
  );

  connectionString = envConfig.url;

  const connectionUrl = new URL(connectionString);
  const isTlsEnabled = Boolean(envConfig.tls);
  const defaultPort = connectionUrl.protocol === "https:" ? "8443" : "8123";
  const port = connectionUrl.port || defaultPort;

  migrationsDir = path.resolve(
    path.dirname(configPath),
    envConfig.migrations.dir,
  );

  tableName = envConfig.migrations.table?.name;
  isReplicated = envConfig.migrations.table?.is_replicated || false;
  clusterName = envConfig.migrations.table?.cluster_name;
  replicationPath = envConfig.migrations.table?.replication_path;

  if (envConfig.tls) {
    const caPath = resolveFromConfigPath(configPath, envConfig.tls.ca_file);
    const certPath = envConfig.tls.cert_file
      ? resolveFromConfigPath(configPath, envConfig.tls.cert_file)
      : undefined;

    const keyPath = envConfig.tls.key_file
      ? resolveFromConfigPath(configPath, envConfig.tls.key_file)
      : undefined;

    tls = {
      caCert: await fs.readFile(caPath),
      cert: certPath ? await fs.readFile(certPath) : undefined,
      key: keyPath ? await fs.readFile(keyPath) : undefined,
    };
  }

  templateVars = {
    ...(envConfig.migrations.vars || {}),
  };

  console.log(
    `  Hostname: ${kleur.bold(connectionUrl.hostname)}:${kleur.bold(port)} ${isTlsEnabled ? kleur.dim("(TLS)") : ""}`,
  );
  console.log(`  Environment: ${kleur.bold(envName)}`);
  console.log("");

  await runMigrations(
    {
      migrationsDir,
      connectionString,
      tableName,
      isReplicated,
      clusterName,
      replicationPath,
      tls,
      templateVars,
    },
    command,
  );
};

program
  .name("clisma")
  .description("💊 ClickHouse Migrations CLI")
  .version(cliVersion, "-v, --version");

withCommonOptions(
  program
    .command("run")
    .description("🏃 Apply Migrations")
    .action((options: CliOptions) => runCommand("run", options)),
);

withCommonOptions(
  program
    .command("status")
    .description("🔍 Show migration Status")
    .action((options: CliOptions) => runCommand("status", options)),
);

program
  .command("create")
  .description("✨ Create a New Migration file")
  .option("--config <path>", "Path to config file (default: clisma.hcl)")
  .option("--env <name>", "Environment name from config file")
  .option("--env-file <path>", "Load environment variables from file")
  .option("--name <name>", "Migration name")
  .action(async (options: CliOptions & { name?: string }) => {
    const baseCwd = process.env.INIT_CWD || process.cwd();
    let migrationsDir: string;
    const envOverrides = options.envFile
      ? await parseEnvFile(path.resolve(baseCwd, options.envFile))
      : undefined;

    const configPath = options.config
      ? path.resolve(baseCwd, options.config)
      : await findConfigFile(baseCwd);

    if (!configPath) {
      throw new Error(
        "Config file is required. Use --config or place clisma.hcl in the current directory.",
      );
    }

    const envName = await resolveEnvName(configPath, options.env);
    const envConfig = await parseConfigFile(
      configPath,
      envName,
      {},
      envOverrides,
    );

    migrationsDir = path.resolve(
      path.dirname(configPath),
      envConfig.migrations.dir,
    );

    // Get migration name from flag or prompt
    let migrationName = options.name;

    if (!migrationName) {
      migrationName = await input({
        message: "Enter migration name:",
        validate: (value: string) => {
          if (!value || value.trim().length === 0) {
            return "Migration name is required";
          }

          if (!/^[a-z0-9_]+$/.test(value)) {
            return "Migration name must contain only lowercase letters, numbers, and underscores";
          }

          return true;
        },
      });
    }

    // Sanitize migration name
    const sanitizedName = migrationName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    // Generate timestamp (YYYYMMDDhhmmss)
    const now = new Date();
    const pad2 = (value: number): string => String(value).padStart(2, "0");
    const timestamp = `${now.getUTCFullYear()}${pad2(
      now.getUTCMonth() + 1,
    )}${pad2(now.getUTCDate())}${pad2(now.getUTCHours())}${pad2(
      now.getUTCMinutes(),
    )}${pad2(now.getUTCSeconds())}`;

    // Create migration filename
    const filename = `${timestamp}_${sanitizedName}.sql`;
    const filepath = path.join(migrationsDir, filename);

    // Ensure migrations directory exists
    await fs.mkdir(migrationsDir, { recursive: true });

    // Create empty migration file with template comment
    const template = `-- Migration: ${sanitizedName}
-- Created: ${new Date().toISOString()}

-- Write your migration here
`;

    await fs.writeFile(filepath, template, "utf8");

    console.log(kleur.green(`Created migration: ${kleur.bold(filename)}`));
    console.log(kleur.dim(`Location: ${filepath}`));
    console.log("");
  });

program
  .command("checksum")
  .description("🤖 Print Checksum for a Migration file")
  .argument("<path>", "Path to migration file")
  .action(async (filePath: string) => {
    const baseCwd = process.env.INIT_CWD || process.cwd();
    const absolutePath = path.resolve(baseCwd, filePath);

    const content = await fs.readFile(absolutePath, "utf8");

    const checksum = crypto.createHash("sha256").update(content).digest("hex");

    console.log(`Checksum: ${kleur.bold(checksum)}`);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(
    kleur.red(error instanceof Error ? error.message : String(error)),
  );

  process.exit(1);
});
