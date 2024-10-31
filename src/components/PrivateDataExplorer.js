import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { b, div, h, p } from 'react-hyperscript-helpers';
import { Link } from 'src/components/common';
import DataExplorerFrame from 'src/components/DataExplorerFrame';
import { centeredSpinner } from 'src/components/icons';
import datasets from 'src/constants/datasets';
import { Groups } from 'src/libs/ajax/Groups';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { contactUsActive } from 'src/libs/state';
import * as Utils from 'src/libs/utils';

/*
  Note: In the following circumstance, this will not show DE even though DE
  could be shown: User logged into multiple Google accounts. One of the accounts
  that's not the current Terra user can see DE.
  We show notInAuthDomain instead of DE in this case because otherwise, user
  won't be able to save to Terra because the current Terra user won't be in
  right auth domain.
  To test "User has not completed oauth for this Data Explorer":
    1. Revoke DE at https://myaccount.google.com/permissions
    2. Clear browser cache
    3. Go to de.appspot.com/_gcp_iap/clear_login_cookie to delete IAP login cookie
  To test "User has completed oauth but has not used DE from this browser:
    2 and 3 from above.
  To test "Used DE from this browser but IAP login cookie has expired":
    No easy way to test, just have to wait for cookie to expire
*/

const PrivateDataExplorer = ({ dataset }) => {
  const [completedDeOauth, setCompletedDeOauth] = useState(undefined);
  const [groups, setGroups] = useState(undefined);

  const signal = useCancellation();

  useOnMount(() => {
    const loadGroups = async () => {
      const { origin } = _.find({ name: dataset }, datasets);

      const [groupObjs] = await Promise.all([
        Groups(signal).list(),
        fetch(`${origin}/favicon.ico`, {
          // The whole point of reading this file is to test IAP. Prevent future
          // fetches from getting this file from disk cache.
          cache: 'no-store',
          // Include IAP login cookie, if it exists
          credentials: 'include',
        })
          // fetch will succeed iff user has used this Data Explorer from
          // this browser.
          .then(() => {
            setCompletedDeOauth(true);
          })
          // fetch will fail if:
          // - User has not completed oauth for this Data Explorer
          // - User has completed oauth but has not used DE from this browser
          // - User has used DE from this browser but IAP login cookie has expired
          .catch(() => {
            setCompletedDeOauth(false);
          }),
      ]);
      setGroups(_.map((g) => g.groupName, groupObjs));
    };

    loadGroups();
  });

  const { authDomain, origin, partner } = _.find({ name: dataset }, datasets);

  const standardErrorText = h(Fragment, [
    p(['This Data Explorer requires you to be in the ', b([authDomain]), ' Terra group.']),
    p([
      'If you have a different Google account in that group, please sign out of Terra and sign in ',
      'with that account. To sign out of Terra, click on the menu on the upper left, click on your ',
      'name, then click Sign Out.',
    ]),
  ]);

  const notInAuthDomainError = div(
    {
      style: { fontSize: 18, margin: '3rem 5rem', width: 800 },
    },
    [
      Utils.switchCase(
        partner,
        [
          'AMP PD',
          () =>
            h(Fragment, [
              standardErrorText,
              p([
                'If you do not have a Google account in that group, please apply for access by emailing ',
                h(Link, { href: 'mailto:admin@amp-pd.org' }, ['admin@amp-pd.org.']),
              ]),
            ]),
        ],
        [
          'baseline',
          () =>
            h(Fragment, [
              p([
                `Thank you for your interest in the Baseline Health Study data. Baseline data is currently only being shared with our partner organizations at Duke and Stanford.
            If you are a researcher at one of our partner organizations, please reach out to your institutional contacts for information on how to obtain access.
            If you are a researcher at our partner site and do not have an institutional contact, please complete the Terra Study Data Request form.`,
              ]),
              p([
                `In the future, Baseline is planning to make this data available to qualified researchers outside of our partners.
            If you're interested in finding out when the data will be available to researchers outside of our partners, please complete the Terra Study Data Request form.`,
              ]),
              p([
                'Please fill out the ',
                h(
                  Link,
                  {
                    href: 'https://forms.gle/d4vnyNvpagptcasf9',
                    ...Utils.newTabLinkProps,
                  },
                  ['Terra Study Data Request Form']
                ),
                ' to be granted access.',
              ]),
            ]),
        ],
        [
          Utils.DEFAULT,
          () =>
            h(Fragment, [
              standardErrorText,
              p([
                'If you do not have a Google account in that group, please ',
                h(
                  Link,
                  {
                    onClick: () => {
                      contactUsActive.set(true);
                    },
                  },
                  ['apply for access.']
                ),
              ]),
            ]),
        ]
      ),
    ]
  );

  return h(Fragment, [
    Utils.cond(
      [groups === undefined || completedDeOauth === undefined, () => centeredSpinner],
      [
        groups?.includes(authDomain) && completedDeOauth === false,
        () => {
          window.open(origin, '_self');
        },
      ],
      [groups?.includes(authDomain), () => h(DataExplorerFrame, { dataset })],
      () => notInAuthDomainError
    ),
  ]);
};

export default PrivateDataExplorer;
