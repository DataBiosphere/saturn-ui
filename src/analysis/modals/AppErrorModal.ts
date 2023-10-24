import _ from 'lodash/fp';
import { useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { spinnerOverlay } from 'src/components/common';
import Modal from 'src/components/Modal';
import { Ajax } from 'src/libs/ajax';
import { ListAppResponse } from 'src/libs/ajax/leonardo/models/app-models';
import { LeoAppProvider } from 'src/libs/ajax/leonardo/providers/LeoAppProvider';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import { useOnMount } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';

export interface AppErrorModalProps {
  app: ListAppResponse;
  onDismiss: () => void;
  appProvider: Pick<LeoAppProvider, 'get'>;
}

export const AppErrorModal = (props: AppErrorModalProps) => {
  const { app, onDismiss, appProvider } = props;
  const [error, setError] = useState<string>();
  const [loadingAppDetails, setLoadingAppDetails] = useState(false);

  const loadAppError = _.flow(
    withErrorReporting('Error loading app details'),
    Utils.withBusyState(setLoadingAppDetails)
  )(async () => {
    const { errors: appErrors } = await appProvider.get(app);

    setError(appErrors[0]?.errorMessage || 'No error messages found for app.');
  });

  useOnMount(() => {
    loadAppError();
  });

  return h(
    Modal,
    {
      title: `App of type '${app.appType}' is in error state`,
      showCancel: false,
      onDismiss,
    },
    [
      div(
        {
          style: {
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            overflowY: 'auto',
            maxHeight: 500,
            background: colors.light(),
          },
        },
        [error]
      ),
      loadingAppDetails && spinnerOverlay,
    ]
  );
};
