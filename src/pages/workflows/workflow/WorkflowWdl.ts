import { ButtonSecondary, icon, useStore } from '@terra-ui-packages/components';
import FileSaver from 'file-saver';
import _ from 'lodash';
import { div, h } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import * as breadcrumbs from 'src/components/breadcrumbs';
import WDLViewer from 'src/components/WDLViewer';
import { forwardRefWithName } from 'src/libs/react-utils';
import { snapshotStore } from 'src/libs/state';
import { wrapWorkflows } from 'src/pages/workflows/workflow/WorkflowWrapper';

export const BaseWorkflowWdl = () => {
  const { name, snapshotId, payload } = useStore(snapshotStore);
  return div(
    { style: { margin: '1rem 1.5rem 2rem', display: 'flex', flexDirection: 'column', flex: 1 }, role: 'tabpanel' },
    [
      div({ style: { marginBottom: '1rem', alignSelf: 'flex-end' } }, [
        h(
          ButtonSecondary,
          {
            onClick: () => {
              const blob = new Blob([payload], { type: 'application/wdl' });
              FileSaver.saveAs(blob, `${name}.${snapshotId}.wdl`);
            },
          },
          [icon('download', { style: { marginRight: '0.5rem' } }), 'Download .wdl']
        ),
      ]),
      div({ style: { flex: 1 } }, [
        h(AutoSizer, [({ height, width }) => h(WDLViewer, { wdl: payload, style: { maxHeight: height, width } })]),
      ]),
    ]
  );
};

const WorkflowWdl = _.flow(
  forwardRefWithName('WorkflowWdl'),
  wrapWorkflows({
    breadcrumbs: () => breadcrumbs.commonPaths.workflowList(),
    activeTab: 'wdl',
  })
)(() => {
  return h(BaseWorkflowWdl);
});

export const navPaths = [
  {
    name: 'workflow-wdl',
    path: '/methods/:namespace/:name/:snapshotId/wdl',
    component: (props) => h(WorkflowWdl, { ...props, tabName: 'wdl' }),
    title: ({ name }) => `${name} - WDL`,
  },
];
