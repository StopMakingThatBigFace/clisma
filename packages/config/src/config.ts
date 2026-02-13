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
  table?: {
    name: string;
    is_replicated: boolean;
    cluster_name?: string;
    replication_path?: string;
  };
  vars?: Record<string, unknown>;
};

export type TlsConfig = {
  ca_file: string;
  cert_file?: string;
  key_file?: string;
};

export type EnvConfig = {
  url: string;
  exclude?: string[];
  tls?: TlsConfig;
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
  tls?: Array<{
    ca_file?: string[] | string;
    cert_file?: string[] | string;
    key_file?: string[] | string;
  }>;
  migrations: Array<{
    dir: string[] | string;
    table?: Array<{
      name?: string[] | string;
      is_replicated?: boolean[] | boolean;
      cluster_name?: string[] | string;
      replication_path?: string[] | string;
    }>;
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

  const tableBlock = migrationBlock.table?.[0];
  const tableName = tableBlock?.name
    ? extractValue(tableBlock.name, "schema_migrations")
    : "schema_migrations";
  const clusterName = tableBlock?.cluster_name
    ? resolveValue(extractValue(tableBlock.cluster_name, ""), env, variables) ||
      undefined
    : undefined;
  const replicationPath = tableBlock?.replication_path
    ? resolveValue(
        extractValue(tableBlock.replication_path, ""),
        env,
        variables,
      ) || undefined
    : undefined;
  const hasIsReplicated = tableBlock?.is_replicated !== undefined;
  const isReplicated = hasIsReplicated
    ? extractValue(tableBlock?.is_replicated, false)
    : Boolean(replicationPath || clusterName);

  // Parse URL
  const url = extractValue(envBlock.url, "");

  if (!url) {
    throw new Error(
      `Database URL not specified for environment "${targetEnv}"`,
    );
  }

  const tlsBlock = envBlock.tls?.[0];

  let tls: TlsConfig | undefined;

  if (tlsBlock) {
    const caFile = tlsBlock.ca_file
      ? resolveValue(extractValue(tlsBlock.ca_file, ""), env, variables)
      : "";

    const certFile = tlsBlock.cert_file
      ? resolveValue(extractValue(tlsBlock.cert_file, ""), env, variables)
      : "";

    const keyFile = tlsBlock.key_file
      ? resolveValue(extractValue(tlsBlock.key_file, ""), env, variables)
      : "";

    if (!caFile) {
      throw new Error(
        `TLS block in environment "${targetEnv}" requires ca_file`,
      );
    }

    if ((certFile && !keyFile) || (!certFile && keyFile)) {
      throw new Error(
        `TLS block in environment "${targetEnv}" requires both cert_file and key_file for mTLS`,
      );
    }

    tls = {
      ca_file: caFile,
      cert_file: certFile || undefined,
      key_file: keyFile || undefined,
    };
  }

  // Parse exclude patterns (optional)
  const excludePatterns = extractList(envBlock.exclude, []);

  return {
    url: resolveValue(url, env, variables),
    exclude: excludePatterns,
    tls,
    migrations: {
      dir: resolveValue(migrationDir, env, variables),
      table: {
        name: tableName,
        is_replicated: isReplicated,
        cluster_name: clusterName,
        replication_path: replicationPath,
      },
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
