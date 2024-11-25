import React from 'react';
import { ButtonPrimary } from 'src/components/common';
import scienceBackground from 'src/images/science-background.jpg';
import { TermsOfService } from 'src/libs/ajax/TermsOfService';
import * as Nav from 'src/libs/nav';
import { RemoteMarkdown } from 'src/libs/util/RemoteMarkdown';
import { docContainerStyles, headerStyles, mainStyles } from 'src/registration/legal-doc-styles';

const PrivacyPolicy = () => {
  return (
    <div role='main' style={mainStyles}>
      <img src={scienceBackground} alt='' style={{ position: 'fixed', top: 0, left: 0, zIndex: -1 }} />
      <div style={docContainerStyles}>
        <h1 style={headerStyles}>Terra Privacy Policy</h1>
        <RemoteMarkdown
          style={{ height: '60vh', overflowY: 'auto', lineHeight: 1.5, marginTop: '1rem', paddingRight: '1rem' }}
          getRemoteText={() => TermsOfService().getPrivacyPolicyText()}
          failureMessage='Could not get Privacy Policy'
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <ButtonPrimary onClick={() => Nav.goToPath('root')}>Back to Terra</ButtonPrimary>
        </div>
      </div>
    </div>
  );
};

export const navPaths = [
  {
    name: 'privacy',
    path: '/privacy',
    component: PrivacyPolicy,
    public: true,
    title: 'Privacy Policy',
  },
];
