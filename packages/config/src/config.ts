import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "@cdktf/hcl2json";
import {
  extractList,
  extractObject,
  extractValue,
  resolveValue,
} from "./utils.js";

export type MigrationConfig = {
  dir: string;
  table_name?: string;
  replication_path?: string;
  vars?: Record<string, unknown>;
};

export type EnvConfig = {
  url: string;
  exclude?: string[];
  cluster_name?: string;
  migrations: MigrationConfig;
};

export type VariableConfig = {
  type: string;
  default?: unknown;
  description?: string;
};

export type ClismaConfig = {
  env: Record<string, EnvConfig>;
  variable?: Record<string, VariableConfig>;
};

type HCLEnvBlock = {
  url: string[] | string;
  exclude?: string[][] | string[];
  cluster_name?: string[] | string;
  migrations: Array<{
    dir: string[] | string;
    table_name?: string[] | string;
    replication_path?: string[] | string;
    vars?: Record<string, unknown>[] | Record<string, unknown>;
  }>;
};

type HCLVariableBlock = {
  type: string[] | string;
  default?: unknown[] | unknown;
  description?: string[] | string;
};

type ParsedHCL = {
  env?: Record<string, HCLEnvBlock[]>;
  variable?: Record<string, HCLVariableBlock[]>;
};

// Helpers live in ./utils.ts to keep parsing logic focused.

/**
 * Parses HCL config file and returns normalized configuration
 */
export const parseConfig = async (
  content: string,
  env: Record<string, string | undefined> = {},
  vars: Record<string, string> = {},
  envName?: string,
  sourceName: string = "clisma.hcl",
): Promise<EnvConfig> => {
  const parsed = (await parse(sourceName, content)) as ParsedHCL;

  if (!parsed.env) {
    throw new Error("No environments defined in config file");
  }

  // Parse variables
  const variables: Record<string, string> = { ...vars };

  if (parsed.variable) {
    for (const [varName, varBlocks] of Object.entries(parsed.variable)) {
      const varBlock = varBlocks[0];

      if (varBlock?.default && !variables[varName]) {
        const defaultValue = extractValue(varBlock.default, "");

        variables[varName] = String(defaultValue);
      }
    }
  }

  // Determine which environment to use
  const targetEnv = envName || Object.keys(parsed.env)[0];

  if (!targetEnv) {
    throw new Error(
      "No environment specified and no default environment found",
    );
  }

  const envBlocks = parsed.env[targetEnv];

  if (!envBlocks || envBlocks.length === 0) {
    throw new Error(`Environment "${targetEnv}" not found in config file`);
  }

  const envBlock = envBlocks[0];

  // Parse migrations config
  const migrationBlock = envBlock.migrations?.[0];

  if (!migrationBlock) {
    throw new Error(
      `No migrations configuration found for environment "${targetEnv}"`,
    );
  }

  const migrationDir = extractValue(migrationBlock.dir, "");

  if (!migrationDir) {
    throw new Error(
      `Migrations directory not specified for environment "${targetEnv}"`,
    );
  }

  // Parse migration vars and resolve them
  const rawVars = extractObject(migrationBlock.vars, {});
  const resolvedVars: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawVars)) {
    if (typeof value === "string") {
      resolvedVars[key] = resolveValue(value, env, variables);
    } else {
      resolvedVars[key] = value;
    }
  }

  // Parse optional table_name
  const tableName = migrationBlock.table_name
    ? extractValue(migrationBlock.table_name, "schema_migrations")
    : "schema_migrations";
  const replicationPath = migrationBlock.replication_path
    ? resolveValue(
        extractValue(migrationBlock.replication_path, ""),
        env,
        variables,
      ) || undefined
    : undefined;

  // Parse URL
  const url = extractValue(envBlock.url, "");

  if (!url) {
    throw new Error(
      `Database URL not specified for environment "${targetEnv}"`,
    );
  }

  const clusterNameValue = envBlock.cluster_name
    ? resolveValue(extractValue(envBlock.cluster_name, ""), env, variables)
    : "";
  const clusterName = clusterNameValue || undefined;

  // Parse exclude patterns (optional)
  const excludePatterns = extractList(envBlock.exclude, []);

  return {
    url: resolveValue(url, env, variables),
    exclude: excludePatterns,
    cluster_name: clusterName,
    migrations: {
      dir: resolveValue(migrationDir, env, variables),
      table_name: tableName,
      replication_path: replicationPath,
      vars: resolvedVars,
    },
  };
};

export const parseConfigFile = async (
  configPath: string,
  envName?: string,
  vars: Record<string, string> = {},
  env: Record<string, string | undefined> = process.env,
): Promise<EnvConfig> => {
  const content = await fs.readFile(configPath, "utf8");

  return parseConfig(content, env, vars, envName, configPath);
};

export const listEnvironments = async (
  content: string,
  sourceName: string = "clisma.hcl",
): Promise<string[]> => {
  const parsed = (await parse(sourceName, content)) as ParsedHCL;
  if (!parsed.env) {
    return [];
  }
  return Object.keys(parsed.env);
};

export const listEnvironmentsFile = async (
  configPath: string,
): Promise<string[]> => {
  const content = await fs.readFile(configPath, "utf8");
  return listEnvironments(content, configPath);
};

/**
 * Finds config file in current directory or parent directories
 */
export const findConfigFile = async (
  startDir: string = process.cwd(),
  fileName: string = "clisma.hcl",
): Promise<string | null> => {
  let currentDir = startDir;

  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const configPath = path.join(currentDir, fileName);

    try {
      await fs.access(configPath);

      return configPath;
    } catch {
      // File not found, continue searching
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
};
