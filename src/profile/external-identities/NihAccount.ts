import { icon, Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, h3, span } from 'react-hyperscript-helpers';
import Collapse from 'src/components/Collapse';
import { ButtonPrimary, Link, spinnerOverlay } from 'src/components/common';
import { InfoBox } from 'src/components/InfoBox';
import { User } from 'src/libs/ajax/User';
import { NihDatasetPermission } from 'src/libs/ajax/User';
import { withErrorReporting } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { useOnMount, useStore } from 'src/libs/react-utils';
import { AuthState, authStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { linkStyles as styles } from 'src/profile/external-identities/LinkStyles';
import { ShibbolethLink } from 'src/profile/external-identities/ShibbolethLink';
import { SpacedSpinner } from 'src/profile/SpacedSpinner';

export const NihAccount = ({ nihToken }) => {
  // State
  const { nihStatus, nihStatusLoaded } = useStore(authStore);
  const [isLinking, setIsLinking] = useState(false);
  const [isConfirmUnlinkModalOpen, setIsConfirmUnlinkModalOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // Lifecycle
  useOnMount(() => {
    const linkNihAccount = _.flow(
      withErrorReporting('Error linking NIH account'),
      Utils.withBusyState(setIsLinking)
    )(async () => {
      const nihStatus = await User().linkNihAccount(nihToken);
      authStore.update((oldState: AuthState) => ({
        ...oldState,
        nihStatus,
        nihStatusLoaded: true,
      }));
    });

    if (nihToken) {
      // Clear the query string, but use replace so the back button doesn't take the user back to the token
      Nav.history.replace({ search: 'tab=externalIdentities' });
      linkNihAccount();
    }
  });

  // Render
  const { linkedNihUsername, linkExpireTime, datasetPermissions } = nihStatus ?? {
    linkedNihUsername: undefined,
    linkExpireTime: NaN,
    datasetPermissions: <NihDatasetPermission[]>[],
  };

  const [authorizedDatasets, unauthorizedDatasets]: [NihDatasetPermission[], NihDatasetPermission[]] = _.flow(
    _.sortBy<NihDatasetPermission>('name'),
    _.partition<NihDatasetPermission>('authorized')
  )(datasetPermissions);

  const isLinked = !!linkedNihUsername && !isLinking;

  return div({ style: styles.idLink.container }, [
    div({ style: styles.idLink.linkContentTop(isLinked) }, [
      div({ style: { ...styles.form.title, marginBottom: 0 } }, [
        h3({ style: { marginRight: '0.5rem', ...styles.idLink.linkName } }, ['NIH Account']),
        h(InfoBox, [
          'Linking with eRA Commons will allow Terra to automatically determine if you can access controlled datasets hosted in Terra (ex. TCGA) ',
          'based on your valid dbGaP applications.',
        ]),
      ]),
      Utils.cond(
        [!nihStatusLoaded, () => h(SpacedSpinner, ['Loading NIH account status...'])],
        [isLinking, () => h(SpacedSpinner, ['Linking NIH account... (This can take a minute or two)'])],
        [!linkedNihUsername, () => div([h(ShibbolethLink, { button: true }, ['Log in to NIH'])])],
        () =>
          h(Fragment, [
            div([span({ style: styles.idLink.linkDetailLabel }, ['Username:']), linkedNihUsername]),
            div([
              span({ style: styles.idLink.linkDetailLabel }, ['Link Expiration:']),
              span([Utils.makeCompleteDate(linkExpireTime * 1000)]),
            ]),
            div([
              h(ShibbolethLink, ['Renew']),
              span({ style: { margin: '0 .25rem 0' } }, [' | ']),
              h(
                Link,
                {
                  'aria-label': 'Unlink NIH account',
                  onClick: () => setIsConfirmUnlinkModalOpen(true),
                },
                ['Unlink']
              ),
            ]),
          ])
      ),
    ]),
    isLinked &&
      div({ style: styles.idLink.linkContentBottom }, [
        h3({ style: { fontWeight: 500, margin: 0 } }, ['Resources']),
        !_.isEmpty(authorizedDatasets) &&
          h(
            Collapse,
            {
              style: { marginTop: '1rem' },
              title: 'Authorized to access',
              titleFirst: true,
              initialOpenState: true,
            },
            [
              div({ style: { marginTop: '0.5rem' } }, [
                _.map(({ name }) => div({ key: name, style: { lineHeight: '24px' } }, [name]), authorizedDatasets),
              ]),
            ]
          ),
        !_.isEmpty(unauthorizedDatasets) &&
          h(
            Collapse,
            {
              style: { marginTop: '1rem' },
              title: 'Not authorized',
              titleFirst: true,
              afterTitle: h(InfoBox, [
                'Your account was linked, but you are not authorized to view these controlled datasets. ',
                'If you think you should have access, please ',
                h(
                  Link,
                  {
                    href: 'https://dbgap.ncbi.nlm.nih.gov/aa/wga.cgi?page=login',
                    ...Utils.newTabLinkProps,
                  },
                  [
                    'verify your credentials here',
                    icon('pop-out', { size: 12, style: { marginLeft: '0.2rem', verticalAlign: 'baseline' } }),
                  ]
                ),
                '.',
              ]),
            },
            [
              div({ style: { marginTop: '0.5rem' } }, [
                _.map(({ name }) => div({ key: name, style: { lineHeight: '24px' } }, [name]), unauthorizedDatasets),
              ]),
            ]
          ),
      ]),
    isConfirmUnlinkModalOpen &&
      h(
        Modal,
        {
          title: 'Confirm unlink account',
          onDismiss: () => setIsConfirmUnlinkModalOpen(false),
          okButton: h(
            ButtonPrimary,
            {
              onClick: _.flow(
                withErrorReporting('Error unlinking account'),
                Utils.withBusyState(setIsUnlinking)
              )(async () => {
                authStore.update(_.set('nihStatusLoaded', false));
                await User().unlinkNihAccount();
                authStore.update((oldState: AuthState) => ({
                  ...oldState,
                  nihStatus: undefined,
                  nihStatusLoaded: true,
                }));
                setIsConfirmUnlinkModalOpen(false);
                notify('success', 'Successfully unlinked account', {
                  message: 'Successfully unlinked your account from NIH.',
                  timeout: 30000,
                });
              }),
            },
            ['OK']
          ),
        },
        [
          div(['Are you sure you want to unlink from NIH?']),
          div({ style: { marginTop: '1rem' } }, [
            'You will lose access to any underlying datasets. You can always re-link your account later.',
          ]),
          isUnlinking && spinnerOverlay,
        ]
      ),
  ]);
};
