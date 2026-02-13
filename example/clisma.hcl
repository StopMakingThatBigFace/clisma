env "local" {
  url = "http://default:password@localhost:8123/default"

  migrations {
    dir = "migrations"
  }
}

env "production" {
  url = "http://default:password@localhost:8123/default"

  tls {
    ca_file = "certs/ca.pem"
    # cert_file = "certs/client.pem"
    # key_file = "certs/client.key"
  }

  migrations {
    dir = "migrations"

    table {
      name = "schema_migrations"

      is_replicated = true

      # Optional: force a specific cluster for ON CLUSTER.
      cluster_name = "prod-cluster"

      # If replication_path is set, is_replicated can be omitted.
      replication_path = "/clickhouse/tables/cluster-{cluster}/shard-{shard}/{database}/schema_migrations"
    }

    vars = {
      is_replicated = true
      create_table_options = "ON CLUSTER prod-cluster"
    }
  }
}
