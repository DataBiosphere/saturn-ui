import * as clipboard from 'clipboard-polyfill/text';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, h2, span } from 'react-hyperscript-helpers';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { Link } from 'src/components/common';
import { icon } from 'src/components/icons';
import { MarkdownViewer, newWindowLinkRenderer } from 'src/components/markdown';
import { TooltipCell } from 'src/components/table';
import { getConfig } from 'src/libs/config';
import { withErrorReporting } from 'src/libs/error';
import { forwardRefWithName, useStore } from 'src/libs/react-utils';
import { snapshotStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import { WorkflowRightBoxSection } from 'src/pages/workflows/components/WorkflowRightBoxSection';
import { wrapWorkflows } from 'src/pages/workflows/workflow/WorkflowWrapper';
import { InfoRow } from 'src/workspaces/dashboard/InfoRow';

export const BaseWorkflowSummary = () => {
  const {
    namespace,
    name,
    snapshotId,
    createDate,
    managers,
    synopsis,
    documentation,
    public: isPublic,
    snapshotComment,
  } = useStore(snapshotStore);
  const persistenceId = `methods/${namespace}/${name}/dashboard`;
  const [importUrlCopied, setImportUrlCopied] = useState<boolean>();
  const importUrl = `${
    getConfig().orchestrationUrlRoot
  }/ga4gh/v1/tools/${namespace}:${name}/versions/${snapshotId}/plain-WDL/descriptor`;

  return div({ style: { flex: 1, display: 'flex' }, role: 'tabpanel' }, [
    div({ style: Style.dashboard.leftBox }, [
      synopsis &&
        h(Fragment, [
          h2({ style: Style.dashboard.header }, ['Synopsis']),
          div({ style: { fontSize: 16 } }, [synopsis]),
        ]),
      h2({ style: Style.dashboard.header }, ['Documentation']),
      documentation
        ? h(MarkdownViewer, { renderers: { link: newWindowLinkRenderer } }, [documentation])
        : div({ style: { fontStyle: 'italic' } }, ['No documentation provided']),
    ]),
    div({ style: Style.dashboard.rightBox }, [
      h(
        WorkflowRightBoxSection,
        {
          title: 'Snapshot Information',
          defaultPanelOpen: true,
          persistenceId: `${persistenceId}/snapshotInfoPanelOpen`,
        },
        [
          h(InfoRow, { title: 'Creation Date' }, [new Date(createDate).toLocaleDateString()]),
          h(InfoRow, { title: 'Publicly Readable' }, [
            span({ style: { display: 'flex', alignItems: 'center' } }, [
              isPublic ? icon('users', { size: 20 }) : icon('lock', { size: 15 }),
              div({ style: { paddingLeft: '0.5rem' } }, [isPublic ? 'Public' : 'Private']),
            ]),
          ]),
          h(InfoRow, { title: 'Snapshot Comment' }, [h(TooltipCell, [snapshotComment])]),
        ]
      ),
      h(
        WorkflowRightBoxSection,
        {
          title: 'Owners',
          persistenceId: `${persistenceId}/ownerPanelOpen`,
        },
        [
          div(
            { style: { margin: '0.5rem' } },
            _.map((email) => {
              return div(
                { key: email, style: { overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.5rem' } },
                [h(Link, { href: `mailto:${email}` }, [email])]
              );
            }, managers)
          ),
        ]
      ),
      h(
        WorkflowRightBoxSection,
        {
          title: 'Import URL',
          persistenceId: `${persistenceId}/importUrlPanelOpen`,
        },
        [
          div({ style: { display: 'flex', marginLeft: '0.5rem' } }, [
            div({ style: Style.noWrapEllipsis }, [importUrl]),
            h(
              Link,
              {
                style: { margin: '0 0.5rem', flexShrink: 0 },
                tooltip: 'Copy import URL',
                onClick: withErrorReporting('Error copying to clipboard')(async () => {
                  await clipboard.writeText(importUrl);
                  setImportUrlCopied(true);
                  setTimeout(() => setImportUrlCopied, 1500);
                }),
              },
              [icon(importUrlCopied ? 'check' : 'copy-to-clipboard')]
            ),
          ]),
        ]
      ),
    ]),
  ]);
};

const WorkflowSummary = _.flow(
  forwardRefWithName('WorkflowSummary'),
  wrapWorkflows({
    breadcrumbs: () => breadcrumbs.commonPaths.workflowList(),
    activeTab: 'dashboard',
  })
)(() => {
  return h(BaseWorkflowSummary);
});

export const navPaths = [
  {
    name: 'workflow-dashboard',
    path: '/methods/:namespace/:name/:snapshotId?',
    component: (props) => h(WorkflowSummary, { ...props, tabName: 'dashboard' }),
    title: ({ name }) => `${name} - Dashboard`,
  },
];
