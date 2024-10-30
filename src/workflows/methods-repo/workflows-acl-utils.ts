export interface WorkflowUserPermissions {
  user: string;
  role: WorkflowAccessLevel;
}

export type WorkflowsPermissions = WorkflowUserPermissions[];

export const publicUser: (userPerms: WorkflowUserPermissions) => boolean = ({ user }) => {
  return user === 'public';
};

export const workflowAccessLevels = ['NO ACCESS', 'READER', 'OWNER'] as const;

export type WorkflowsAccessLevels = typeof workflowAccessLevels;

export type WorkflowAccessLevel = WorkflowsAccessLevels[number];
