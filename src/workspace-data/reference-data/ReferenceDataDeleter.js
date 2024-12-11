import _ from 'lodash/fp';
import { useState } from 'react';
import { b, div, h } from 'react-hyperscript-helpers';
import { absoluteSpinnerOverlay, DeleteConfirmationModal } from 'src/components/common';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';

import { getReferenceLabel } from './reference-data-utils';
import ReferenceData from './references';

export const ReferenceDataDeleter = ({ onSuccess, onDismiss, namespace, name, referenceDataType }) => {
  const [deleting, setDeleting] = useState(false);

  return h(
    DeleteConfirmationModal,
    {
      objectType: 'reference',
      objectName: referenceDataType,
      onConfirm: async () => {
        setDeleting(true);
        try {
          await Workspaces()
            .workspace(namespace, name)
            .deleteAttributes(_.map((key) => `referenceData_${referenceDataType}_${key}`, _.keys(ReferenceData[referenceDataType])));
          onSuccess(referenceDataType);
        } catch (error) {
          reportError('Error deleting reference data', error);
          onDismiss();
        }
      },
      onDismiss,
    },
    [div(['Are you sure you want to delete the ', b([getReferenceLabel(referenceDataType)]), ' reference data?']), deleting && absoluteSpinnerOverlay]
  );
};
