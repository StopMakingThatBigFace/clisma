CREATE TABLE IF NOT EXISTS events {{create_table_options}} (
  id UUID,
  created_at DateTime DEFAULT now()
)
{{#if is_replicated}}
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{cluster}/events', '{replica}')
{{else}}
ENGINE = MergeTree()
{{/if}}
ORDER BY id;
