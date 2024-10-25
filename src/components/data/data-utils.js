import _ from 'lodash/fp';
import { canUseWorkspaceProject } from 'src/libs/ajax/billing/Billing';
import { requesterPaysProjectStore } from 'src/libs/state';

export const parseGsUri = (uri) => _.drop(1, /gs:[/][/]([^/]+)[/](.+)/.exec(uri));

export const getUserProjectForWorkspace = async (workspace) =>
  workspace && (await canUseWorkspaceProject(workspace)) ? workspace.workspace.googleProject : requesterPaysProjectStore.get();
