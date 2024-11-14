import _ from 'lodash/fp';
import { canWrite, WorkspaceWrapper as Workspace } from 'src/workspaces/utils';

export interface CategorizedWorkspaces {
  myWorkspaces: Workspace[];
  featured: Workspace[];
  public: Workspace[];
}

export const categorizeWorkspaces = (
  workspaces: Workspace[],
  featuredList?: { name: string; namespace: string }[]
): CategorizedWorkspaces => {
  return {
    myWorkspaces: _.filter((ws) => !ws.public || canWrite(ws.accessLevel), workspaces),
    public: _.filter('public', workspaces),
    featured: _.flow(
      _.map(({ namespace, name }) => _.find({ workspace: { namespace, name } }, workspaces)),
      _.compact
    )(featuredList),
  };
};
