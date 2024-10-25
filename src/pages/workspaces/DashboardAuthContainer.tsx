import { cond, DEFAULT } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import React, { ReactNode, useEffect, useState } from 'react';
import { centeredSpinner } from 'src/components/icons';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { useStore } from 'src/libs/react-utils';
import { authStore } from 'src/libs/state';
import SignIn from 'src/pages/SignIn';
import DashboardPublic from 'src/pages/workspaces/DashboardPublic';
import { WorkspaceDashboardPage } from 'src/workspaces/dashboard/WorkspaceDashboardPage';

export interface DashboardAuthContainerProps {
  namespace: string;
  name: string;
}

export const DashboardAuthContainer = (props: DashboardAuthContainerProps): ReactNode => {
  const { namespace, name } = props;
  const { signInStatus } = useStore(authStore);
  const [featuredWorkspaces, setFeaturedWorkspaces] = useState<{ name: string; namespace: string }[]>();

  const isAuthInitialized = signInStatus !== 'uninitialized';

  useEffect(() => {
    const fetchData = async () => {
      setFeaturedWorkspaces(await FirecloudBucket().getFeaturedWorkspaces());
    };
    if (signInStatus === 'signedOut') {
      fetchData();
    }
  }, [signInStatus]);

  const isFeaturedWorkspace = () => _.some((ws) => ws.namespace === namespace && ws.name === name, featuredWorkspaces);

  return cond(
    [
      !isAuthInitialized || (signInStatus === 'signedOut' && featuredWorkspaces === undefined),
      () => centeredSpinner({ style: { position: 'fixed' } }),
    ],
    [signInStatus === 'signedOut' && isFeaturedWorkspace(), () => <DashboardPublic {...{ name, namespace }} />],
    [signInStatus === 'signedOut', () => <SignIn />],
    [DEFAULT, () => <WorkspaceDashboardPage {...{ name, namespace }} />]
  );
};
