import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useRef, useState } from 'react';
import { b, div, h } from 'react-hyperscript-helpers';
import { ButtonPrimary, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import * as Nav from 'src/libs/nav';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { useWorkspaces } from 'src/workspaces/common/state/useWorkspaces';
import { WorkspaceSelector } from 'src/workspaces/common/WorkspaceSelector';
import { isValidWsExportTarget } from 'src/workspaces/utils';
import validate from 'validate.js';

const InfoTile = ({ isError = false, content }) => {
  const [style, shape, color] = isError
    ? [Style.errorStyle, 'error-standard', colors.danger()]
    : [Style.warningStyle, 'warning-standard', colors.warning()];

  return div({ style: { ...style, display: 'flex', alignItems: 'center' } }, [
    icon(shape, { size: 36, style: { color, flex: 'none', marginRight: '0.5rem' } }),
    content,
  ]);
};

const displayEntities = (entities, showType) => {
  return _.map(
    ([i, entity]) =>
      div(
        {
          style: {
            borderTop: i === 0 ? undefined : Style.standardLine,
            padding: '0.6rem 1.25rem',
            ...Style.noWrapEllipsis,
          },
        },
        showType ? `${entity.entityName} (${entity.entityType})` : entity
      ),
    Utils.toIndexPairs(entities)
  );
};

export const ExportDataModal = ({ onDismiss, selectedDataType, selectedEntities, workspace }) => {
  // State
  const [hardConflicts, setHardConflicts] = useState([]);
  const [softConflicts, setSoftConflicts] = useState([]);
  const [additionalDeletions, setAdditionalDeletions] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(undefined);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const scollableRef = useRef();
  const { workspaces, loading } = useWorkspaces();

  // Helpers
  const getSelectedWorkspace = () => _.find({ workspace: { workspaceId: selectedWorkspaceId } }, workspaces).workspace;

  const copy = async () => {
    const selectedWorkspace = getSelectedWorkspace();
    const entitiesToDelete = _.concat(hardConflicts, additionalDeletions);
    setCopying(true);
    if (hardConflicts.length) {
      try {
        await Workspaces().workspace(selectedWorkspace.namespace, selectedWorkspace.name).deleteEntities(entitiesToDelete);
        setHardConflicts([]);
        setAdditionalDeletions([]);
      } catch (error) {
        switch (error.status) {
          case 409:
            setAdditionalDeletions(_.filter((entity) => entity.entityType !== selectedDataType, await error.json())); // handles dangling references when deleting entities
            setCopying(false);
            return;
          default:
            await reportError('Error deleting data entries', error);
            onDismiss();
        }
      }
    }
    try {
      await Workspaces()
        .workspace(workspace.workspace.namespace, workspace.workspace.name)
        .copyEntities(selectedWorkspace.namespace, selectedWorkspace.name, selectedDataType, selectedEntities, !!softConflicts.length);
      setCopied(true);
      void Metrics().captureEvent(Events.workspaceDataCopy, extractWorkspaceDetails(workspace.workspace));
    } catch (error) {
      switch (error.status) {
        case 409:
          const { hardConflicts, softConflicts } = await error.json();
          setHardConflicts(hardConflicts);
          setSoftConflicts(softConflicts);
          setCopying(false);
          scollableRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          break;
        default:
          await reportError('Error copying data entries', error);
          onDismiss();
      }
    }
  };

  // Rendering
  const renderCopyForm = () => {
    const errors = validate({ selectedWorkspaceId }, { selectedWorkspaceId: { presence: true } });

    return h(
      Modal,
      {
        onDismiss,
        title: 'Export Data to Workspace',
        okButton: h(
          ButtonPrimary,
          {
            tooltip: hardConflicts.length ? 'Are you sure you want to override existing data?' : Utils.summarizeErrors(errors),
            disabled: !!errors || copying,
            onClick: copy,
          },
          ['Copy']
        ),
        overlayRef: (node) => {
          scollableRef.current = node;
        },
      },
      [
        !(!!hardConflicts.length || !!additionalDeletions.length || !!softConflicts.length) &&
          h(Fragment, [
            h(FormLabel, { required: true }, ['Destination']),
            h(WorkspaceSelector, {
              workspaces: _.filter(isValidWsExportTarget(workspace), workspaces),
              value: selectedWorkspaceId,
              onChange: setSelectedWorkspaceId,
            }),
          ]),
        !!hardConflicts.length &&
          InfoTile({
            isError: true,
            content:
              'Some of the following data already exists in the selected workspace. Click CANCEL to go back or COPY to override the existing data.',
          }),
        !!additionalDeletions.length &&
          InfoTile({
            content: 'To override the selected data entries, the following entries that reference the original data will also be deleted.',
          }),
        !!softConflicts.length &&
          InfoTile({
            content:
              'The following data is linked to entries which already exist in the selected workspace. You may re-link the following data to the existing entries by clicking COPY.',
          }),
        h(FormLabel, ['Entries selected']),
        // Size the scroll container to cut off the last row to hint that there's more content to be scrolled into view
        // Row height calculation is font size * line height + padding + border
        div({ style: { maxHeight: 'calc((1em * 1.15 + 1.2rem + 1px) * 10.5)', overflowY: 'auto', margin: '0 -1.25rem' } }, [
          ...Utils.cond(
            [!!additionalDeletions.length, () => displayEntities(additionalDeletions, true)],
            [!!hardConflicts.length, () => displayEntities(hardConflicts, true)],
            [!!softConflicts.length, () => displayEntities(softConflicts, true)],
            () => displayEntities(selectedEntities, false)
          ),
        ]),
        div(
          {
            style: { ...Style.warningStyle, textAlign: 'right', marginTop: hardConflicts.length ? '1rem' : undefined },
          },
          [`${selectedEntities.length} data entries to be copied.`]
        ),
        (copying || loading) && spinnerOverlay,
      ]
    );
  };

  const renderPostCopy = () => {
    const selectedWorkspace = getSelectedWorkspace();

    return h(
      Modal,
      {
        title: 'Copy to Workspace',
        onDismiss,
        cancelText: 'Stay Here',
        okButton: h(
          ButtonPrimary,
          {
            onClick: () => {
              Nav.goToPath('workspace-data', {
                namespace: selectedWorkspace.namespace,
                name: selectedWorkspace.name,
              });
            },
          },
          ['Go to copied data']
        ),
      },
      ['Successfully copied data to ', b([selectedWorkspace.name]), '. Do you want to view the copied data?']
    );
  };

  return copied ? renderPostCopy() : renderCopyForm();
};
