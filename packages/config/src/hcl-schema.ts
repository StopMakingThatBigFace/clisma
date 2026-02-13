export const clismaSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "clisma.hcl",
  type: "object",
  additionalProperties: false,
  properties: {
    env: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: {
          $ref: "#/$defs/envBlock",
        },
      },
    },
    variable: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: {
          $ref: "#/$defs/variableBlock",
        },
      },
    },
  },
  $defs: {
    envBlock: {
      type: "object",
      additionalProperties: false,
      required: ["url", "migrations"],
      properties: {
        url: {
          type: "string",
          description: "ClickHouse connection string.",
        },
        exclude: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Optional glob patterns to exclude tables.",
        },
        tls: {
          type: "array",
          items: {
            $ref: "#/$defs/tlsBlock",
          },
          description:
            "Optional TLS settings for custom CA and mutual TLS client certificates.",
        },
        migrations: {
          type: "array",
          items: {
            $ref: "#/$defs/migrationsBlock",
          },
        },
      },
    },
    migrationsBlock: {
      type: "object",
      additionalProperties: false,
      required: ["dir"],
      properties: {
        dir: {
          type: "string",
          description: "Path to migrations directory.",
        },
        table: {
          type: "array",
          items: {
            $ref: "#/$defs/tableBlock",
          },
          description: "Migrations tracking table configuration.",
        },
        vars: {
          type: "object",
          description: "Variables for Handlebars templates.",
          additionalProperties: {
            $ref: "#/$defs/variableValue",
          },
        },
      },
    },
    tableBlock: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "Custom table name for migration tracking.",
        },
        is_replicated: {
          type: "boolean",
          description:
            "Whether tracking table should use ReplicatedReplacingMergeTree and ON CLUSTER.",
        },
        cluster_name: {
          type: "string",
          description:
            "Optional cluster name override for ON CLUSTER when replicated mode is enabled.",
        },
        replication_path: {
          type: "string",
          description:
            "Optional replication path for the migrations table in replicated setups.",
        },
      },
    },
    tlsBlock: {
      type: "object",
      additionalProperties: false,
      required: ["ca_file"],
      properties: {
        ca_file: {
          type: "string",
          description:
            "Path to CA certificate file (PEM) used to verify the server certificate.",
        },
        cert_file: {
          type: "string",
          description:
            "Path to client certificate file (PEM) for mutual TLS.",
        },
        key_file: {
          type: "string",
          description: "Path to client private key file (PEM) for mutual TLS.",
        },
      },
    },
    variableBlock: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: {
          type: "string",
          description: "Variable type.",
          enum: ["string", "number", "bool", "any"],
        },
        default: {
          $ref: "#/$defs/variableValue",
        },
        description: {
          type: "string",
        },
      },
    },
    variableValue: {
      type: ["string", "number", "boolean", "object", "array", "null"],
    },
  },
} as const;

export const generateSchema = (): typeof clismaSchema => {
  return clismaSchema;
};
