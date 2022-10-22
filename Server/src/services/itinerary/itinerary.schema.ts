import { schema } from "@feathersjs/schema";
import type { Infer } from "@feathersjs/schema";
import { refreshDataQuerySchema } from "../refresh-data/refresh-data.schema";

// Schema for the basic data model (e.g. creating new entries)
export const itineraryDataSchema = schema({
  $id: "ItineraryData",
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
} as const);

export type ItineraryData = Infer<typeof itineraryDataSchema>;

// Schema for making partial updates
export const itineraryPatchSchema = schema({
  $id: "ItineraryPatch",
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    ...itineraryDataSchema.properties,
  },
} as const);

export type ItineraryPatch = Infer<typeof itineraryPatchSchema>;

// Schema for the data that is being returned
const itineraryResultRawSchema = {
  definitions: {
    FOOTStageDetails: {
      type: "object",
      additionalProperties: false,
      required: ["distance"],
      properties: {
        distance: {
          type: "integer",
        },
      },
    },
    TBMStageDetails: {
      type: "object",
      additionalProperties: false,
      required: ["type", "line", "direction", "departure"],
      properties: {
        type: {
          type: "string",
          enum: ["BUS", "TRAM", "BATEAU"],
        },
        line: {
          type: "string",
        },
        direction: {
          type: "string",
        },
        departure: {
          type: "integer",
        },
      },
    },
    SNCFStageDetails: {
      type: "object",
      additionalProperties: false,
      required: ["type", "line", "direction", "departure"],
      properties: {
        type: {
          type: "string",
          enum: ["TRAIN"],
        },
        line: {
          type: "string",
        },
        direction: {
          type: "string",
        },
        departure: {
          type: "integer",
        },
      },
    },
  },
  $id: "ItineraryResult",
  type: "object",
  additionalProperties: false,
  required: [...itineraryDataSchema.required, "code", "message", "lastActualization", "paths"],
  properties: {
    ...itineraryDataSchema.properties,
    code: {
      type: "integer",
      minimum: 200,
      maximum: 599,
    },
    message: {
      type: "string",
    },
    lastActualization: {
      type: "integer",
    },
    paths: {
      type: "array",
      uniqueItems: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "totalDuration", "totalDistance", "departure", "from", "stages"],
        properties: {
          id: {
            type: "string",
          },
          totalDuration: {
            type: "integer",
          },
          totalDistance: {
            type: "integer",
          },
          departure: {
            type: "integer",
          },
          from: {
            type: "string",
          },
          stages: {
            type: "array",
            uniqueItems: true,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "to", "duration", "details"],
              properties: {
                type: {
                  type: "string",
                  enum: ["FOOT", "TBM", "SNCF"],
                },
                to: {
                  type: "string",
                },
                duration: {
                  type: "integer",
                },
                details: {
                  type: "object",
                  oneOf: [
                    { $ref: "#/definitions/FOOTStageDetails" },
                    { $ref: "#/definitions/TBMStageDetails" },
                    { $ref: "#/definitions/SNCFStageDetails" },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  allOf: [
    /* {
      if: {
        properties: {
          paths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { const: "FOOT" },
                    }
                  }
                }
              }
            }
          }
        }
      },
      then: {
        properties: {
          paths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      details: {
                        $ref: "#/definitions/FOOTStageDetails",
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
    }, */
    {
      if: {
        properties: {
          paths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { const: "TBM" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      then: {
        properties: {
          paths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      details: {
                        $ref: "#/definitions/TBMStageDetails",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      if: {
        properties: {
          paths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { const: "SNCF" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      then: {
        properties: {
          paths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      details: {
                        $ref: "#/definitions/SNCFStageDetails",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ],
} as const;

export const itineraryResultSchema = schema(itineraryResultRawSchema);

export type Stage_type = "FOOT" | "TBM" | "SNCF";
type ItineraryStageResult<S extends Stage_type> = S extends "FOOT"
  ? {
    type: S;
    details: {
      distance: number;
    };
  }
  : S extends "TBM"
  ? {
    type: S;
    details: {
      type: "BUS" | "TRAM" | "BATEAU";
      line: string;
      direction: string;
      departure: number;
    };
  }
  : S extends "SNCF"
  ? {
    type: S;
    details: {
      type: "TRAIN";
      line: string;
      direction: string;
      departure: number;
    };
  }
  : never;

export type ItineraryResult = {
  code: number;
  message: string;
  lastActualization: number;
  paths: {
    departure: number;
    id: string;
    totalDuration: number;
    totalDistance: number;
    from: string;
    stages: (ItineraryStageResult<Stage_type> & {
      to: string;
      duration: number;
    })[];
  }[];
};

// Schema for allowed query properties
export const itineraryQuerySchema = schema({
  $id: "ItineraryQuery",
  type: "object",
  additionalProperties: false,
  properties: {
    from: {
      type: "string",
    },
    to: {
      type: "string",
    },
    transports: {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {
        FOOT: {
          type: "boolean",
        },
        TBM: {
          type: "boolean",
        },
        SNCF: {
          type: "boolean",
        },
      },
    },
    departureTime: {
      type: "string",
    },
    /**
     * @description The maximum allowed distance to walk, in meters.
     */
    maxWalkDistance: {
      type: "integer",
    },
    /**
     * @description The average walk speed to take in account, in km/h.
     */
    walkSpeed: {
      type: "number",
    },
    ...refreshDataQuerySchema.properties,
  },
});

export type ItineraryQuery = Infer<typeof itineraryQuerySchema>;
