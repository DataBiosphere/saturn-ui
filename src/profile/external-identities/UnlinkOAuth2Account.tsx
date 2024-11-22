import { Clickable, ClickableProps, Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { ReactNode, useState } from 'react';
import { ButtonPrimary, spinnerOverlay } from 'src/components/common';
import { ExternalCredentials } from 'src/libs/ajax/ExternalCredentials';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import Events from 'src/libs/events';
import { notify } from 'src/libs/notifications';
import { authStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { OAuth2Provider } from 'src/profile/external-identities/OAuth2Providers';

const styles = {
  clickableLink: {
    display: 'inline',
    color: colors.accent(),
    cursor: 'pointer',
    fontWeight: 500,
  },
};
interface UnlinkOAuth2AccountProps extends ClickableProps {
  linkText: string;
  provider: OAuth2Provider;
}

export const UnlinkOAuth2Account = ({ linkText, provider }: UnlinkOAuth2AccountProps): ReactNode => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isUnlinking, setIsUnlinking] = useState<boolean>(false);

  const okButton = (
    <ButtonPrimary
      onClick={_.flow(
        withErrorReporting('Error unlinking account'),
        Utils.withBusyState(setIsUnlinking)
      )(async () => {
        await ExternalCredentials()(provider).unlinkAccount();
        authStore.update(_.unset(['oAuth2AccountStatus', provider.key]));
        void Metrics().captureEvent(Events.user.externalCredential.unlink, { provider: provider.key });
        setIsModalOpen(false);
        notify('success', 'Successfully unlinked account', {
          message: `Successfully unlinked your account from ${provider.name}`,
          timeout: 30000,
        });
      })}
    >
      OK
    </ButtonPrimary>
  );

  return (
    <div style={{ display: 'inline-flex' }}>
      <Clickable style={styles.clickableLink} onClick={() => setIsModalOpen(true)}>
        {linkText}
      </Clickable>
      {isModalOpen && (
        <Modal title='Confirm unlink account' onDismiss={() => setIsModalOpen(false)} okButton={okButton}>
          <div>Are you sure you want to unlink from {provider.name}?</div>
          <div style={{ marginTop: '1rem' }}>
            {provider.isFence &&
              'You will lose access to any underlying datasets. You can always re-link your account later.'}
          </div>
          {isUnlinking && spinnerOverlay}
        </Modal>
      )}
    </div>
  );
};
