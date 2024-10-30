import { Modal } from '@terra-ui-packages/components';
import { useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { ButtonPrimary, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { Metrics } from 'src/libs/ajax/Metrics';
import { SamResources } from 'src/libs/ajax/SamResources';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import Events from 'src/libs/events';

const LeaveResourceModal = ({ displayName, samResourceType, samResourceId, onDismiss, onSuccess }) => {
  const [leaving, setLeaving] = useState(false);
  const helpText = `Leave ${displayName}`;

  const leaveResource = async () => {
    try {
      setLeaving(true);
      await SamResources().leave(samResourceType, samResourceId);
      void Metrics().captureEvent(Events.resourceLeave, { samResourceType, samResourceId });
      setLeaving(false);
      onDismiss();
      onSuccess();
    } catch (error) {
      const { message } = await error.json();
      void Metrics().captureEvent(Events.resourceLeave, { samResourceType, samResourceId, errorMessage: message });
      reportError(message);
      setLeaving(false);
      onDismiss();
    }
  };

  return h(
    Modal,
    {
      title: span({ style: { display: 'flex', alignItems: 'center' } }, [
        icon('warning-standard', { size: 24, color: colors.warning() }),
        span({ style: { marginLeft: '1ch' } }, [helpText]),
      ]),
      styles: { modal: { background: colors.warning(0.1) } },
      onDismiss,
      okButton: h(
        ButtonPrimary,
        {
          onClick: leaveResource,
        },
        helpText
      ),
    },
    [div([`Are you sure you want to leave this ${displayName}? `]), leaving && spinnerOverlay]
  );
};

export default LeaveResourceModal;
