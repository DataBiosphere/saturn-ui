import { WorkflowUserPermissions } from 'src/libs/ajax/methods/methods-models';

export type {
  WorkflowAccessLevel,
  WorkflowUserPermissions,
  MethodConfigACL as WorkflowsPermissions,
} from 'src/libs/ajax/methods/methods-models';

export const publicUser = ({ user }: WorkflowUserPermissions): boolean => user === 'public';
