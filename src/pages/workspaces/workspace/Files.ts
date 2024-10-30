import { Link } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { div, h } from 'react-hyperscript-helpers';
import * as breadcrumbs from 'src/components/breadcrumbs';
import FileBrowser from 'src/components/file-browser/FileBrowser';
import { icon } from 'src/components/icons';
import AzureBlobStorageFileBrowserProvider from 'src/libs/ajax/file-browser-providers/AzureBlobStorageFileBrowserProvider';
import GCSFileBrowserProvider from 'src/libs/ajax/file-browser-providers/GCSFileBrowserProvider';
import { useQueryParameter } from 'src/libs/nav';
import { forwardRefWithName } from 'src/libs/react-utils';
import { wrapWorkspace } from 'src/workspaces/container/WorkspaceContainer';
import { isAzureWorkspace, WorkspaceWrapper } from 'src/workspaces/utils';
import { useMemo } from 'use-memo-one';

export const Files = _.flow(
  forwardRefWithName('Files'),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Files',
  })
)(({ workspace }: { workspace: WorkspaceWrapper }, _ref) => {
  const { workspace: workspaceInfo } = workspace;
  const fileBrowserProvider = useMemo(() => {
    if (workspaceInfo.cloudPlatform === 'Azure') {
      const { workspaceId } = workspaceInfo;
      return AzureBlobStorageFileBrowserProvider({ workspaceId });
    }
    const { bucketName, googleProject } = workspaceInfo;
    return GCSFileBrowserProvider({ bucket: bucketName, project: googleProject });
  }, [workspaceInfo]);

  const rootLabel = isAzureWorkspace(workspace) ? 'Workspace cloud storage' : 'Workspace bucket';

  const [path, setPath] = useQueryParameter('path');

  return div(
    {
      style: {
        flex: '1 1 0',
        overflow: 'hidden',
      },
    },
    [
      h(FileBrowser, {
        initialPath: path || '',
        workspace,
        provider: fileBrowserProvider,
        rootLabel,
        title: 'Files',
        onChangePath: setPath,
        extraMenuItems: h(
          Link,
          {
            href: `https://seqr.broadinstitute.org/workspace/${workspaceInfo.namespace}/${workspaceInfo.name}`,
            style: { padding: '0.5rem' },
            target: '_blank',
          },
          [icon('pop-out'), ' Analyze in Seqr']
        ),
      }),
    ]
  );
});

export const navPaths = [
  {
    name: 'workspace-files',
    path: '/workspaces/:namespace/:name/files',
    component: Files,
    title: ({ name }) => `${name} - Files`,
  },
];
