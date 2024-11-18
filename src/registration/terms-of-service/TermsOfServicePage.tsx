import React, { useState } from 'react';
import { signOut } from 'src/auth/signout/sign-out';
import { loadTerraUser } from 'src/auth/user-profile/user';
import { ButtonPrimary, ButtonSecondary, spinnerOverlay } from 'src/components/common';
import scienceBackground from 'src/images/science-background.jpg';
import { TermsOfService } from 'src/libs/ajax/TermsOfService';
import { reportError } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { useStore } from 'src/libs/react-utils';
import { authStore } from 'src/libs/state';
import { RemoteMarkdown } from 'src/libs/util/RemoteMarkdown';
import { docContainerStyles, headerStyles, mainStyles } from 'src/registration/legal-doc-styles';
import { tosAlertsStore } from 'src/registration/terms-of-service/terms-of-service-alerts';

export const TermsOfServicePage = () => {
  const [busy, setBusy] = useState<boolean>();
  const { signInStatus, termsOfService, terraUserAllowances } = useStore(authStore);
  const acceptedLatestTos = termsOfService.isCurrentVersion === true;
  const usageAllowed = terraUserAllowances.details.termsOfService === true;
  const requiredToAcceptTermsOfService = signInStatus === 'userLoaded' && !(acceptedLatestTos && usageAllowed);
  const showButtons = signInStatus === 'userLoaded' || signInStatus === 'signedOut';

  const accept = async () => {
    try {
      setBusy(true);
      await TermsOfService().acceptTermsOfService();
      await loadTerraUser();
      // Clear out the alerts so that the user doesn't see the alert again after accepting the TOS.
      tosAlertsStore.reset();
      Nav.goToPath('root');
    } catch (error) {
      reportError('Error accepting Terms of Service', error);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    try {
      setBusy(true);
      await TermsOfService().rejectTermsOfService();
    } catch (error) {
      reportError('Error rejecting Terms of Service', error);
    } finally {
      setBusy(false);
      signOut('declinedTos');
    }
  };

  const backToTerraButton = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
      <ButtonPrimary onClick={() => Nav.goToPath('root')} disabled={busy}>
        Back to Terra
      </ButtonPrimary>
    </div>
  );

  const acceptTosButtons = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
      <ButtonSecondary style={{ marginRight: '1rem' }} onClick={reject} disabled={busy}>
        Decline and Sign Out
      </ButtonSecondary>
      <ButtonPrimary onClick={accept} disabled={busy}>
        Accept
      </ButtonPrimary>
    </div>
  );

  // TODO: Remove nested ternary to align with style guide
  // eslint-disable-next-line no-nested-ternary
  const buttons = showButtons
    ? requiredToAcceptTermsOfService
      ? acceptTosButtons
      : backToTerraButton
    : spinnerOverlay;

  return (
    <div role='main' style={mainStyles}>
      <img src={scienceBackground} alt='' style={{ position: 'fixed', top: 0, left: 0, zIndex: -1 }} />
      <div style={docContainerStyles}>
        <h1 style={headerStyles}>Terra Terms of Service</h1>
        {requiredToAcceptTermsOfService && (
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Please accept the Terms of Service to continue.</h2>
        )}
        <RemoteMarkdown
          style={{ height: '60vh', overflowY: 'auto', lineHeight: 1.5, marginTop: '1rem', paddingRight: '1rem' }}
          getRemoteText={() => TermsOfService().getTermsOfServiceText()}
          failureMessage='Could not get Terms of Service'
        />
        {buttons}
      </div>
    </div>
  );
};
export const navPaths = [
  {
    name: 'terms-of-service',
    path: '/terms-of-service',
    component: TermsOfServicePage,
    public: true,
    title: 'Terms of Service',
  },
];
