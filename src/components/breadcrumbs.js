import { a } from 'react-hyperscript-helpers';
import { icon } from 'src/components/icons';
import { isTerra } from 'src/libs/brand-utils';
import colors from 'src/libs/colors';
import * as Nav from 'src/libs/nav';

export const breadcrumbElement = (child, href) => {
  return a(
    {
      style: { color: isTerra() ? 'white' : colors.accent() },
      href,
    },
    [child, icon('angle-right', { size: 10, style: { margin: '0 0.25rem' } })]
  );
};

export const commonPaths = {
  datasetList: () => [breadcrumbElement('Datasets', Nav.getLink('library-datasets'))],

  workflowList: () => [breadcrumbElement('Workflows', Nav.getLink('workflows'))],

  workspaceList: () => [breadcrumbElement('Workspaces', Nav.getLink('workspaces'))],

  workspaceDashboard: ({ namespace, name }) => [
    ...commonPaths.workspaceList(),
    breadcrumbElement(`${namespace}/${name}`, Nav.getLink('workspace-dashboard', { namespace, name })),
  ],

  workspaceTab: ({ namespace, name }, activeTab) => [
    ...commonPaths.workspaceDashboard({ namespace, name }),
    breadcrumbElement(activeTab, Nav.getLink(`workspace-${activeTab}`, { namespace, name })),
  ],
};
