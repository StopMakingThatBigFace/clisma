env "local" {
  url = "http://default:password@localhost:8123/default"

  migrations {
    dir = "migrations"
  }
}

env "production" {
  url = "http://default:password@localhost:8123/default"
  cluster_name = "prod-cluster"

  migrations {
    dir = "migrations"
    vars = {
      is_replicated = true
      create_table_options = "ON CLUSTER prod-cluster"
    }
  }
}
