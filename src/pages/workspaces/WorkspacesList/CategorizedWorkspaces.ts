import _ from 'lodash/fp';
import { canWrite, WorkspaceWrapper as Workspace } from 'src/libs/workspace-utils';

export interface CategorizedWorkspaces {
  myWorkspaces: Workspace[];
  newAndInteresting: Workspace[];
  featured: Workspace[];
  public: Workspace[];
}

export const categorizeWorkspaces = (
  workspaces: Workspace[],
  featuredList?: { name: string; namespace: string }[]
): CategorizedWorkspaces => {
  const [newWsList, featuredWsList] = _.partition('isNew', featuredList);

  return {
    myWorkspaces: _.filter((ws) => !ws.public || canWrite(ws.accessLevel), workspaces),
    public: _.filter('public', workspaces),
    newAndInteresting: _.flow(
      _.map(({ namespace, name }) => _.find({ workspace: { namespace, name } }, workspaces)),
      _.compact
    )(newWsList),
    featured: _.flow(
      _.map(({ namespace, name }) => _.find({ workspace: { namespace, name } }, workspaces)),
      _.compact
    )(featuredWsList),
  };
};
