export type MigrationRunnerOptions = {
  migrationsDir: string;
  connectionString: string;
  clusterName?: string;
  tableName?: string;
  replicationPath?: string;
  templateVars?: Record<string, unknown>;
};

export type MigrationCommand = "run" | "status";

export type MigrationContext = {
  is_replicated: boolean;
  create_table_options: string;
  cluster: string;
};

export type MigrationRecord = {
  version: string;
  name: string;
  checksum: string;
  hostname: string;
  applied_by: string;
  cli_version: string;
  applied_at: string;
};

export type PendingMigration = {
  version: string;
  name: string;
  file: string;
  content: string;
  checksum: string;
};

export type PendingMigrationsResult = {
  pending: PendingMigration[];
  error: Error | null;
};
