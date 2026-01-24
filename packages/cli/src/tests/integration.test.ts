import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);

const isDockerAvailable = async (): Promise<boolean> => {
  try {
    await exec("docker", ["--version"]);
    await exec("docker", ["compose", "version"]);
    return true;
  } catch {
    return false;
  }
};

const waitForClickHouse = async (baseUrl: string): Promise<void> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/ping`);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore until ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("ClickHouse did not become ready in time");
};

const runCli = async (
  repoRoot: string,
  args: string[],
): Promise<void> => {
  const cliPath = path.join(repoRoot, "packages/cli/src/cli.ts");
  await exec(
    "node",
    ["--import", "tsx", cliPath, ...args],
    { cwd: repoRoot },
  );
};

const queryClickHouse = async (
  baseUrl: string,
  query: string,
): Promise<string> => {
  const response = await fetch(`${baseUrl}/?query=${encodeURIComponent(query)}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickHouse query failed: ${text}`);
  }
  return response.text();
};

test("cli applies migrations against ClickHouse", async (t) => {
  if (!(await isDockerAvailable())) {
    t.skip("Docker not available");
    return;
  }

  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "clisma-it-"));
  const migrationsDir = path.join(tempDir, "migrations");
  await fs.mkdir(migrationsDir, { recursive: true });

  const baseUrl = "http://localhost:8123";
  const dbName = `clisma_it_${Date.now()}`;

  await exec("docker", ["compose", "up", "-d"]);

  t.after(async () => {
    try {
      await exec("docker", ["compose", "down", "-v"]);
    } catch {
      // Ignore cleanup failures.
    }
  });

  await waitForClickHouse(baseUrl);
  await queryClickHouse(baseUrl, `CREATE DATABASE IF NOT EXISTS ${dbName}`);

  const configPath = path.join(tempDir, "clisma.hcl");
  await fs.writeFile(
    configPath,
    `env "local" {\n  url = "http://default:@localhost:8123/${dbName}"\n\n  migrations {\n    dir = "migrations"\n  }\n}\n`,
    "utf8",
  );

  const migrationFile = path.join(
    migrationsDir,
    "20240101120000_create_table.sql",
  );
  await fs.writeFile(
    migrationFile,
    "CREATE TABLE IF NOT EXISTS test_table (id UInt64) ENGINE = MergeTree() ORDER BY id;",
    "utf8",
  );

  await runCli(repoRoot, ["run", "--config", configPath, "--env", "local"]);

  const tableExists = await queryClickHouse(
    baseUrl,
    `EXISTS TABLE ${dbName}.test_table`,
  );
  assert.equal(tableExists.trim(), "1");

  const migrationsCount = await queryClickHouse(
    baseUrl,
    `SELECT count() FROM ${dbName}.schema_migrations`,
  );
  assert.equal(migrationsCount.trim(), "1");

  await queryClickHouse(baseUrl, `DROP DATABASE IF EXISTS ${dbName}`);
});
