import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { b, div, h, p } from 'react-hyperscript-helpers';
import { ClipboardButton } from 'src/components/ClipboardButton';
import { ButtonPrimary, ButtonSecondary, IdContainer, Link, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { ValidatedInput } from 'src/components/input';
import { MarkdownEditor, MarkdownViewer } from 'src/components/markdown';
import { DataRepo } from 'src/libs/ajax/DataRepo';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { getConfig } from 'src/libs/config';
import { reportError } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { canWrite } from 'src/workspaces/utils';
import validate from 'validate.js';

const SnapshotLabeledInfo = ({ title, text }) => {
  return div({ style: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem' } }, [
    div({ style: { ...Style.elements.sectionHeader, marginRight: '1rem' } }, [title]),
    text,
  ]);
};

export const SnapshotInfo = ({
  workspace: {
    accessLevel,
    workspace,
    workspace: { namespace, name },
  },
  resource: { resourceId, description, snapshotId },
  snapshotName,
  onUpdate,
  onDelete,
}) => {
  // State
  const [snapshotInfo, setSelectedSnapshotInfo] = useState();
  const [snapshotLoadError, setSnapshotLoadError] = useState();
  const [newName, setNewName] = useState(snapshotName);
  const [editingName, setEditingName] = useState(false);
  const [newDescription, setNewDescription] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const signal = useCancellation();

  // Helpers
  const save = async () => {
    try {
      setSaving(true); // this will be unmounted in the reload, so no need to reset this
      await Workspaces().workspace(namespace, name).snapshot(resourceId).update({ name: newName, description: newDescription });
      onUpdate(newName);
    } catch (e) {
      setSaving(false);
      reportError('Error updating snapshot', e);
    }
  };

  // Lifecycle
  useOnMount(() => {
    const loadSnapshotInfo = async () => {
      try {
        const snapshotInfo = await DataRepo(signal).snapshot(snapshotId).details();
        setSelectedSnapshotInfo(snapshotInfo);
        setSnapshotLoadError(undefined);
      } catch (e) {
        try {
          e.status === 403
            ? setSnapshotLoadError('You do not have access to this snapshot. Please review your data access.')
            : setSnapshotLoadError(`Unexpected error contacting Terra Data Repo: ${await e.json()}`);
        } catch (inner) {
          setSnapshotLoadError(`Unknown error contacting Terra Data Repo: ${JSON.stringify(e)}`);
        }
        setSelectedSnapshotInfo({});
      }
    };
    loadSnapshotInfo();
  });

  // Render
  const { name: sourceName, description: sourceDescription, createdDate, source = [] } = snapshotInfo || {};
  const editingDescription = _.isString(newDescription);
  const errors = validate.single(newName, {
    format: {
      pattern: /^[a-zA-Z0-9]+\w*$/, // don't need presence requirement since '+' enforces at least 1 character
      message: "Name can only contain letters, numbers, and underscores, and can't start with an underscore.",
    },
    length: { maximum: 63, tooLong: "Name can't be more than 63 characters." },
  });

  const tdrErrorDisplay = () => div({ style: { paddingLeft: '1rem' } }, [div({ style: Style.dashboard.header }, ['Error']), snapshotLoadError]);

  const tdrDetails = () =>
    !snapshotLoadError &&
    div({ style: { paddingLeft: '1rem' } }, [
      div({ style: Style.dashboard.header }, ['Linked Data Repo Snapshot']),
      h(SnapshotLabeledInfo, { title: 'Name:', text: sourceName }),
      h(SnapshotLabeledInfo, { title: 'Creation Date:', text: Utils.makeCompleteDate(createdDate) }),
      div({ style: { ...Style.elements.sectionHeader, marginBottom: '0.2rem' } }, ['Description:']),
      div([sourceDescription]),
      h(SnapshotLabeledInfo, {
        title: 'Data Repo Snapshot Id:',
        text: [
          h(
            Link,
            {
              href: `${getConfig().dataRepoUrlRoot}/snapshots/${snapshotId}`,
              target: '_blank',
              'aria-label': 'Go to the snapshot in a new tab',
            },
            [snapshotId]
          ),
          h(ClipboardButton, { 'aria-label': 'Copy data repo snapshot id to clipboard', text: snapshotId, style: { marginLeft: '0.25rem' } }),
        ],
      }),
      div({ style: Style.dashboard.header }, [`Source Data Repo Dataset${source.length > 1 ? 's' : ''}`]),
      _.map(({ dataset: { id, name: datasetName, description: datasetDescription, createdDate: datasetCreatedDate } }) => {
        return div(
          {
            key: id,
            style: { marginBottom: '1rem' },
          },
          [
            h(SnapshotLabeledInfo, { title: 'Name:', text: datasetName }),
            h(SnapshotLabeledInfo, { title: 'Creation Date:', text: Utils.makeCompleteDate(datasetCreatedDate) }),
            div({ style: { ...Style.elements.sectionHeader, marginBottom: '0.2rem' } }, ['Description:']),
            div([datasetDescription]),
            h(SnapshotLabeledInfo, {
              title: 'Data Repo Dataset Id:',
              text: [
                h(
                  Link,
                  {
                    href: `${getConfig().dataRepoUrlRoot}/datasets/${id}`,
                    target: '_blank',
                    'aria-label': 'Go to the dataset in a new tab',
                  },
                  [id]
                ),
                h(ClipboardButton, { 'aria-label': 'Copy data repo dataset id to clipboard', text: id, style: { marginLeft: '0.25rem' } }),
              ],
            }),
          ]
        );
      }, source),
    ]);

  return snapshotInfo === undefined
    ? spinnerOverlay
    : h(Fragment, [
        div({ style: { padding: '1rem' } }, [
          div({ style: Style.elements.card.container }, [
            div(
              {
                style: {
                  ...Style.elements.sectionHeader,
                  fontSize: 20,
                  borderBottom: Style.standardLine,
                  paddingBottom: '0.5rem',
                  marginBottom: '1rem',
                },
              },
              [
                snapshotName,
                canWrite(accessLevel) &&
                  !editingName &&
                  h(
                    Link,
                    {
                      style: { marginLeft: '0.5rem' },
                      onClick: () => setEditingName(true),
                      tooltip: 'Edit snapshot name',
                    },
                    [icon('edit')]
                  ),
              ]
            ),
            div({ style: { ...Style.elements.sectionHeader, marginBottom: '0.2rem' } }, [
              'Description:',
              canWrite(accessLevel) &&
                !editingDescription &&
                h(
                  Link,
                  {
                    style: { marginLeft: '0.5rem' },
                    onClick: () => setNewDescription(description || ''), // description is null for newly-added snapshot references
                    tooltip: 'Edit description',
                  },
                  [icon('edit')]
                ),
            ]),
            editingDescription
              ? h(Fragment, [
                  h(MarkdownEditor, {
                    placeholder: 'Enter a description',
                    value: newDescription,
                    onChange: setNewDescription,
                  }),
                  div({ style: { display: 'flex', justifyContent: 'flex-end', margin: '1rem' } }, [
                    h(ButtonSecondary, { onClick: () => setNewDescription(undefined) }, 'Cancel'),
                    h(ButtonPrimary, { style: { marginLeft: '1rem' }, onClick: save }, 'Save'),
                  ]),
                ])
              : h(MarkdownViewer, [description || '']), // description is null for newly-added snapshot references
          ]),

          snapshotLoadError ? tdrErrorDisplay() : tdrDetails(),

          canWrite(accessLevel) &&
            div({ style: { marginTop: '2rem' } }, [h(ButtonSecondary, { onClick: () => setDeleting(true) }, ['Delete snapshot from workspace'])]),
          editingName &&
            h(
              Modal,
              {
                onDismiss: () => {
                  setNewName(snapshotName);
                  setEditingName(false);
                },
                title: `Rename ${snapshotName}`,
                okButton: h(
                  ButtonPrimary,
                  {
                    onClick: () => {
                      setEditingName(false);
                      save();
                    },
                    disabled: !!errors || snapshotName === newName,
                    tooltip: Utils.summarizeErrors(errors) || (snapshotName === newName && 'No change to save'),
                  },
                  ['Rename']
                ),
              },
              [
                h(IdContainer, [
                  (id) =>
                    h(Fragment, [
                      h(FormLabel, { htmlFor: id }, ['New snapshot name']),
                      h(ValidatedInput, {
                        inputProps: {
                          id,
                          autoFocus: true,
                          placeholder: 'Enter a name',
                          value: newName,
                          onChange: setNewName,
                        },
                        error: Utils.summarizeErrors(errors),
                      }),
                    ]),
                ]),
              ]
            ),
          deleting &&
            h(
              Modal,
              {
                onDismiss: () => setDeleting(false),
                okButton: async () => {
                  try {
                    setSaving(true); // this will be unmounted in the reload, so no need to reset this
                    setDeleting(false);
                    await Workspaces().workspace(namespace, name).snapshot(resourceId).delete();
                    void Metrics().captureEvent(Events.workspaceSnapshotDelete, {
                      ...extractWorkspaceDetails(workspace),
                      resourceId,
                      snapshotId,
                    });
                    onDelete();
                  } catch (e) {
                    setSaving(false);
                    reportError('Error deleting snapshot', e);
                  }
                },
                title: 'Delete Snapshot',
              },
              [
                p(['Do you want to remove the snapshot ', b([snapshotName]), ' from this workspace?']),
                p(['Its source snapshot in the Data Repo, ', b([sourceName]), ', will be unaffected.']),
              ]
            ),
          saving && spinnerOverlay,
        ]),
      ]);
};
