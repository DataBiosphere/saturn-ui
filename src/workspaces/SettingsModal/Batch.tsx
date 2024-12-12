import { ExternalLink } from '@terra-ui-packages/components';
import React, { ReactNode } from 'react';
import Setting from 'src/workspaces/SettingsModal/Setting';

interface BatchProps {
  batchEnabled: boolean;
  setBatchEnabled: (enabled: boolean) => void;
  isOwner: boolean;
}

const Batch = (props: BatchProps): ReactNode => {
  const { batchEnabled, setBatchEnabled, isOwner } = props;

  const settingToggled = (checked: boolean) => setBatchEnabled(checked);

  return (
    <Setting
      settingEnabled={batchEnabled}
      setSettingEnabled={settingToggled}
      label='GCP Batch:'
      isOwner={isOwner}
      description={
        <>
          When <ExternalLink href='https://cloud.google.com/batch/docs'>batch</ExternalLink> is enabled, workflows will
          be processed by the GCP Batch service, rather than the former Cloud Life Sciences API{' '}
        </>
      }
    />
  );
};

export default Batch;
