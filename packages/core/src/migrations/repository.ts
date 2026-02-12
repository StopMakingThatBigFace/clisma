import fs from "node:fs/promises";
import path from "node:path";
import kleur from "kleur";
import type { ClickHouseClient } from "@clickhouse/client";
import type {
  MigrationContext,
  MigrationRecord,
  PendingMigration,
  PendingMigrationsResult,
} from "./types.js";
import { calculateChecksum } from "./sql.js";

type MigrationRepositoryOptions = {
  client: ClickHouseClient;
  migrationsDir: string;
  tableName: string;
  replicationPath?: string;
};

export class MigrationRepository {
  #client: ClickHouseClient;
  #ctx: MigrationContext | null = null;
  #migrationsDir: string;
  #tableName: string;
  #replicationPath?: string;

  constructor(options: MigrationRepositoryOptions) {
    this.#client = options.client;
    this.#migrationsDir = options.migrationsDir;
    this.#tableName = options.tableName;
    this.#replicationPath = options.replicationPath;
  }

  getContext(): MigrationContext {
    if (!this.#ctx) {
      throw new Error("Migration repository not initialized");
    }

    return this.#ctx;
  }

  async initialize(clusterName?: string): Promise<string | null> {
    if (this.#ctx) {
      return this.#ctx.cluster || null;
    }

    const clusters = await this.#listClusters();
    const clusterNames = Array.from(
      new Set(clusters.map((cluster) => cluster.cluster)),
    );

    const hasNonDefaultCluster = clusterNames.some(
      (name) => name !== "default",
    );

    const defaultClusterRows = clusters.filter(
      (cluster) => cluster.cluster === "default",
    );

    const defaultHasReplicasOrShards = defaultClusterRows.some(
      (row) => row.replica_num > 1 || row.shard_num > 1,
    );

    if (!clusterName) {
      if (hasNonDefaultCluster || defaultHasReplicasOrShards) {
        const available = clusterNames.length
          ? clusterNames.join(", ")
          : "none";

        throw new Error(
          `Cluster detected but no cluster_name provided. ` +
            `Set env.cluster_name in config. Available clusters: ${available}`,
        );
      }
    } else if (!clusterNames.includes(clusterName)) {
      const available = clusterNames.length ? clusterNames.join(", ") : "none";

      throw new Error(
        `Cluster "${clusterName}" not found. Available clusters: ${available}`,
      );
    }

    if (clusterName) {
      const safeClusterName = clusterName.replace(/"/g, '\\"');

      this.#ctx = {
        is_replicated: true,
        create_table_options: `ON CLUSTER "${safeClusterName}"`,
        cluster: clusterName,
      };

      return clusterName;
    }

    this.#ctx = {
      is_replicated: false,
      create_table_options: "",
      cluster: "",
    };

    return null;
  }

  async ensureMigrationsTable(): Promise<void> {
    const ctx = this.getContext();
    const replicationPath = this.#replicationPath
      ? this.#replicationPath
      : `/clickhouse/tables/cluster-{cluster}/shard-{shard}/{database}/${this.#tableName}`;

    const engine = ctx.is_replicated
      ? `ReplicatedReplacingMergeTree('${replicationPath}', '{replica}')`
      : "ReplacingMergeTree()";

    const tableOptions = ctx.create_table_options || "";

    await this.#client.command({
      query: `
        CREATE TABLE IF NOT EXISTS ${this.#tableName} ${tableOptions} (
          version String,
          name String,
          checksum String,
          hostname String DEFAULT '',
          applied_by String DEFAULT '',
          cli_version String DEFAULT '',
          applied_at DateTime DEFAULT now()
        ) ENGINE = ${engine}
        ORDER BY version
      `,
    });
  }

  async getAppliedMigrations(): Promise<Map<string, MigrationRecord>> {
    const result = await this.#client.query({
      query: `
        SELECT version, name, checksum, hostname, applied_by, cli_version, applied_at
        FROM ${this.#tableName} FINAL 
        ORDER BY version`,
      format: "JSONEachRow",
    });

    const migrations = await result.json<MigrationRecord>();

    return new Map(
      migrations.map((migration) => [migration.version, migration]),
    );
  }

  async getPendingMigrations(
    applied: Map<string, MigrationRecord>,
  ): Promise<PendingMigrationsResult> {
    const files = (await fs.readdir(this.#migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const pending: PendingMigration[] = [];

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);

      if (!match) {
        console.warn(kleur.yellow(`Skipping invalid filename: ${file}`));
        continue;
      }

      const [, version, name] = match;
      const filePath = path.join(this.#migrationsDir, file);

      const content = await fs.readFile(filePath, "utf8");
      const checksum = calculateChecksum(content);
      const appliedMigration = applied.get(version);

      if (!appliedMigration) {
        pending.push({ version, name, file, content, checksum });
        continue;
      }

      if (appliedMigration.checksum !== checksum) {
        return {
          pending: [],
          error: new Error(
            `Migration ${version}_${name} has been modified. ` +
              `Expected checksum: ${appliedMigration.checksum}. ` +
              `Actual checksum: ${checksum}. `,
          ),
        };
      }
    }

    return { pending, error: null };
  }

  async #listClusters(): Promise<
    Array<{ cluster: string; shard_num: number; replica_num: number }>
  > {
    const result = await this.#client.query({
      query: `
        SELECT cluster, shard_num, replica_num
        FROM system.clusters
      `,
      format: "JSONEachRow",
    });

    return await result.json<{
      cluster: string;
      shard_num: number;
      replica_num: number;
    }>();
  }
}
