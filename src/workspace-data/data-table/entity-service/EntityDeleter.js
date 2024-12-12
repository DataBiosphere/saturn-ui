import _ from 'lodash/fp';
import { useState } from 'react';
import { b, div, h } from 'react-hyperscript-helpers';
import { absoluteSpinnerOverlay, DeleteConfirmationModal } from 'src/components/common';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import * as Utils from 'src/libs/utils';

export const EntityDeleter = ({ onDismiss, onSuccess, namespace, name, selectedEntities, runningSubmissionsCount }) => {
  const [additionalDeletions, setAdditionalDeletions] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const selectedKeys = _.keys(selectedEntities);

  const doDelete = async () => {
    const entitiesToDelete = _.flow(
      _.map(({ name: entityName, entityType }) => ({ entityName, entityType })),
      (entities) => _.concat(additionalDeletions, entities)
    )(selectedEntities);

    setDeleting(true);

    try {
      await Workspaces().workspace(namespace, name).deleteEntities(entitiesToDelete);
      onSuccess();
    } catch (error) {
      switch (error.status) {
        case 409:
          setAdditionalDeletions(
            _.filter(
              (errorEntity) =>
                !_.some(
                  (selectedEntity) => selectedEntity.entityType === errorEntity.entityType && selectedEntity.entityName === errorEntity.entityName,
                  entitiesToDelete
                ),
              await error.json()
            )
          );
          setDeleting(false);
          break;
        default:
          await reportError('Error deleting data entries', error);
          onDismiss();
      }
    }
  };

  const moreToDelete = !!additionalDeletions.length;

  const total = selectedKeys.length + additionalDeletions.length;
  return h(
    DeleteConfirmationModal,
    {
      objectType: 'data',
      title: `Delete ${total} ${total > 1 ? 'entries' : 'entry'}`,
      onConfirm: doDelete,
      onDismiss,
    },
    [
      runningSubmissionsCount > 0 &&
        b({ style: { display: 'block', margin: '1rem 0' } }, [
          `WARNING: ${runningSubmissionsCount} workflows are currently running in this workspace. ` +
            'Deleting the following entries could cause workflows using them to fail.',
        ]),
      moreToDelete &&
        b({ style: { display: 'block', margin: '1rem 0' } }, [
          'In order to delete the selected data entries, the following entries that reference them must also be deleted.',
        ]),
      // Size the scroll container to cut off the last row to hint that there's more content to be scrolled into view
      // Row height calculation is font size * line height + padding + border
      div(
        { style: { maxHeight: 'calc((1em * 1.15 + 1.2rem + 1px) * 10.5)', overflowY: 'auto', margin: '0 -1.25rem' } },
        _.map(
          ([i, entity]) =>
            div(
              {
                style: {
                  borderTop: i === 0 && runningSubmissionsCount === 0 ? undefined : `1px solid ${colors.light()}`,
                  padding: '0.6rem 1.25rem',
                },
              },
              moreToDelete ? `${entity.entityName} (${entity.entityType})` : entity
            ),
          Utils.toIndexPairs(moreToDelete ? additionalDeletions : selectedKeys)
        )
      ),
      deleting && absoluteSpinnerOverlay,
    ]
  );
};
