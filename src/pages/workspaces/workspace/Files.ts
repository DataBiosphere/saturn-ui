import { Link } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { div, h } from 'react-hyperscript-helpers';
import { bucketBrowserUrl } from 'src/auth/auth';
import * as breadcrumbs from 'src/components/breadcrumbs';
import FileBrowser from 'src/components/file-browser/FileBrowser';
import { icon } from 'src/components/icons';
import AzureBlobStorageFileBrowserProvider from 'src/libs/ajax/file-browser-providers/AzureBlobStorageFileBrowserProvider';
import GCSFileBrowserProvider from 'src/libs/ajax/file-browser-providers/GCSFileBrowserProvider';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { useQueryParameter } from 'src/libs/nav';
import { forwardRefWithName } from 'src/libs/react-utils';
import { newTabLinkProps } from 'src/libs/utils';
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

  const rootLabel = workspaceInfo.name;

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
        title: isAzureWorkspace(workspace)
          ? 'Files'
          : h(
              Link,
              {
                href: bucketBrowserUrl(workspaceInfo.bucketName),
                style: { margin: '1rem 0.5rem' },
                ...newTabLinkProps,
                onClick: () => {
                  void Metrics().captureEvent(Events.workspaceOpenedBucketInBrowser, {
                    ...extractWorkspaceDetails(workspace),
                  });
                },
              },
              ['Open bucket in browser ', icon('pop-out', { size: 12 })]
            ),
        onChangePath: setPath,
        extraMenuItems: h(
          Link,
          {
            href: `https://seqr.broadinstitute.org/workspace/${workspaceInfo.namespace}/${workspaceInfo.name}`,
            style: { padding: '0.5rem' },
            ...newTabLinkProps,
            onClick: () => {
              void Metrics().captureEvent(Events.workspaceFilesSeqr, {
                workspaceNamespace: workspaceInfo.namespace,
                workspaceName: workspaceInfo.name,
              });
            },
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
