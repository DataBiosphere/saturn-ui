/**
 * Type for Orchestration's MethodQuery schema.
 *
 * Note: Some properties that are required here are marked as optional in the
 * schema, but the Orchestration endpoint that uses this schema for the request
 * body requires them to be included.
 */
export interface MethodQuery {
  namespace: string;
  name: string;
  synopsis?: string;
  snapshotComment?: string;
  documentation?: string;
  payload: string;
  entityType: string;
}

/**
 * Type for Orchestration's MethodResponse schema.
 *
 * Note: Some properties that are optional here are marked as required in the
 * schema, but the Orchestration API does not always include them in its
 * responses.
 */
export interface MethodResponse {
  managers?: string[];
  namespace: string;
  name: string;
  snapshotId: number;
  snapshotComment?: string;
  synopsis?: string;
  documentation?: string;
  createDate?: string;
  url?: string;
  payload?: string;
  entityType?: string;
}
