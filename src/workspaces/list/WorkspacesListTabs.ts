import _ from 'lodash/fp';
import { ReactNode, useMemo } from 'react';
import { h, span } from 'react-hyperscript-helpers';
import { SimpleTabBar } from 'src/components/tabBars';
import Events from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { textMatch } from 'src/libs/utils';
import { CategorizedWorkspaces } from 'src/workspaces/list/CategorizedWorkspaces';
import { NoContentMessage } from 'src/workspaces/list/NoContentMessage';
import { RenderedWorkspaces } from 'src/workspaces/list/RenderedWorkspaces';
import { getWorkspaceFiltersFromQuery, WorkspaceFilterValues } from 'src/workspaces/list/WorkspaceFilters';
import { getCloudProviderFromWorkspace, WorkspaceWrapper as Workspace } from 'src/workspaces/utils';

export interface WorkspaceTab {
  key: string;
  title: ReactNode;
  tableName: string;
}

interface WorkspacesListTabsProps {
  loadingWorkspaces: boolean;
  workspaces: CategorizedWorkspaces;
  refreshWorkspaces: () => void;
}

export const WorkspacesListTabs = (props: WorkspacesListTabsProps): ReactNode => {
  const { workspaces, loadingWorkspaces } = props;
  const { query } = Nav.useRoute();
  const filters = getWorkspaceFiltersFromQuery(query);

  const filteredWorkspaces = useMemo(() => filterWorkspaces(workspaces, filters), [workspaces, filters]);

  const tabs: WorkspaceTab[] = _.map(
    (key: keyof CategorizedWorkspaces) => ({
      key,
      title: span([_.upperCase(key), ` (${loadingWorkspaces ? '...' : filteredWorkspaces[key].length})`]),
      tableName: _.lowerCase(key),
    }),
    ['myWorkspaces', 'featured', 'public']
  );

  return h(
    SimpleTabBar,
    {
      'aria-label': 'choose a workspace collection',
      metricsPrefix: Events.workspacesListSelectTab,
      value: filters.tab,
      onChange: (newTab) => {
        if (newTab === filters.tab) {
          props.refreshWorkspaces();
        } else {
          Nav.updateSearch({ ...query, tab: newTab === 'myWorkspaces' ? undefined : newTab });
        }
      },
      tabs,
    },
    [
      h(RenderedWorkspaces, {
        workspaces: filteredWorkspaces[filters.tab],
        label: _.lowerCase(filters.tab),
        noContent: h(NoContentMessage, { workspaces, filters, loadingWorkspaces }),
      }),
    ]
  );
};

// exported for unit testing
export const filterWorkspaces = (
  workspaces: CategorizedWorkspaces,
  filters: WorkspaceFilterValues
): CategorizedWorkspaces => {
  const filterWorkspacesCategory = (workspaces: Workspace[], filters: WorkspaceFilterValues): Workspace[] => {
    const matches = (ws: Workspace): boolean => {
      const {
        workspace: { namespace, name, attributes, state, googleProject, bucketName },
      } = ws;

      const containsKeywordFilter = (textToMatchWithin: string | undefined): boolean => {
        return textToMatchWithin === undefined ? false : textMatch(filters.keywordFilter, textToMatchWithin!);
      };

      return !!(
        (containsKeywordFilter(`${namespace}/${name}`) ||
          containsKeywordFilter(googleProject) ||
          containsKeywordFilter(state) ||
          containsKeywordFilter(bucketName)) &&
        (_.isEmpty(filters.accessLevels) || filters.accessLevels.includes(ws.accessLevel)) &&
        (_.isEmpty(filters.projects) || filters.projects === namespace) &&
        (_.isEmpty(filters.cloudPlatform) || getCloudProviderFromWorkspace(ws) === filters.cloudPlatform) &&
        _.every((a) => _.includes(a, _.get(['tag:tags', 'items'], attributes)), filters.tags)
      );
    };
    return _.filter(matches, workspaces);
  };

  return {
    myWorkspaces: filterWorkspacesCategory(workspaces.myWorkspaces, filters),
    public: filterWorkspacesCategory(workspaces.public, filters),
    featured: filterWorkspacesCategory(workspaces.featured, filters),
  };
};
