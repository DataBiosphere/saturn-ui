import { useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { centeredSpinner } from 'src/components/icons';
import { ModalToolButton } from 'src/components/ModalToolButton';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { workflowSelectionStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';

const WorkflowSelector = ({
  workspace: {
    workspace: { namespace, name },
  },
  selectedEntities,
}) => {
  const workspacesAjax = Workspaces(useCancellation());
  const [loading, setLoading] = useState();
  const [configs, setConfigs] = useState();
  const selectionKey = useUniqueId();

  useOnMount(() => {
    const loadWorkflows = _.flow(
      withErrorReporting('Error loading configs'),
      Utils.withBusyState(setLoading)
    )(async () => setConfigs(await workspacesAjax.workspace(namespace, name).listMethodConfigs()));

    workflowSelectionStore.set({
      key: selectionKey,
      entityType: _.values(selectedEntities)[0].entityType,
      entities: selectedEntities,
    });

    loadWorkflows();
  });

  const makeWfCard = ({ namespace: workflowNamespace, name: workflowName }) =>
    h(ModalToolButton, {
      href: `${Nav.getLink('workflow', { namespace, name, workflowNamespace, workflowName })}?selectionKey=${selectionKey}`,
      style: { marginBottom: '1rem', height: 50, flex: 'none' },
      text: workflowName,
      onClick: () => {
        void Metrics().captureEvent(Events.workspaceDataOpenWithWorkflow, extractWorkspaceDetails({ namespace, name }));
      },
    });

  return div({ style: { ...Style.modalDrawer.content, overflowY: 'auto' } }, [loading ? centeredSpinner() : h(Fragment, _.map(makeWfCard, configs))]);
};

export default WorkflowSelector;
