/**
 * Type for Agora's MethodDefinition schema.
 */
export interface MethodDefinition {
  namespace: string;
  name: string;
  synopsis: string;
  managers: string[];
  public: boolean;
  numConfigurations: number;
  numSnapshots: number;
  entityType: string;
}

/**
 * Corresponds to Agora's MethodResponse schema. Represents information about
 * a method snapshot in the Broad Methods Repository.
 */
export interface Snapshot {
  managers: string[];
  name: string;
  createDate: string;
  documentation?: string;
  entityType: string;
  snapshotComment: string;
  snapshotId: number;
  namespace: string;
  payload: string;
  url: string;
  public: boolean | undefined;
  synopsis: string;
}

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

export type WorkflowAccessLevel = 'NO ACCESS' | 'READER' | 'OWNER';
export interface WorkflowUserPermissions {
  user: string;
  role: WorkflowAccessLevel;
}

/**
 * Type for Orchestration's MethodConfigACL schema.
 */
export type MethodConfigACL = WorkflowUserPermissions[];
