import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { ButtonPrimary, Select, spinnerOverlay } from 'src/components/common';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';

import { getReferenceLabel } from './reference-data-utils';
import ReferenceData from './references';

export const ReferenceDataImporter = ({ onSuccess, onDismiss, namespace, name }) => {
  const [loading, setLoading] = useState(false);
  const [selectedReference, setSelectedReference] = useState(undefined);

  return h(
    Modal,
    {
      'aria-label': 'Add Reference Data',
      onDismiss,
      title: 'Add Reference Data',
      okButton: h(
        ButtonPrimary,
        {
          disabled: !selectedReference || loading,
          onClick: async () => {
            setLoading(true);
            try {
              await Workspaces()
                .workspace(namespace, name)
                .shallowMergeNewAttributes(_.mapKeys((k) => `referenceData_${selectedReference}_${k}`, ReferenceData[selectedReference]));
              onSuccess(selectedReference);
            } catch (error) {
              await reportError('Error importing reference data', error);
              onDismiss();
            }
          },
        },
        'OK'
      ),
    },
    [
      h(Select, {
        'aria-label': 'Select data',
        autoFocus: true,
        isSearchable: false,
        placeholder: 'Select data',
        value: selectedReference,
        onChange: ({ value }) => setSelectedReference(value),
        options: _.keys(ReferenceData).map((referenceName) => ({ value: referenceName, label: getReferenceLabel(referenceName) })),
      }),
      loading && spinnerOverlay,
    ]
  );
};
