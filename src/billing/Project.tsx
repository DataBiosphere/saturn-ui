import { Icon, SpinnerOverlay } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import * as qs from 'qs';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { BillingAccountControls } from 'src/billing/BillingAccount/BillingAccountControls';
import { BillingAccountSummary, BillingAccountSummaryProps } from 'src/billing/BillingAccount/BillingAccountSummary';
import { Members } from 'src/billing/Members/Members';
import { ExternalLink } from 'src/billing/NewBillingProjectWizard/StepWizard/ExternalLink';
import { SpendReport } from 'src/billing/SpendReport/SpendReport';
import { accountLinkStyle, BillingAccountStatus, billingRoles } from 'src/billing/utils';
import { Workspaces } from 'src/billing/Workspaces/Workspaces';
import {
  BillingProject,
  GoogleBillingAccount,
  isAzureBillingProject,
  isGoogleBillingProject,
} from 'src/billing-core/models';
import { Link } from 'src/components/common';
import { InfoBox } from 'src/components/InfoBox';
import { SimpleTabBar } from 'src/components/tabBars';
import { Member } from 'src/groups/Members/MemberTable';
import { Billing } from 'src/libs/ajax/billing/Billing';
import colors from 'src/libs/colors';
import { reportErrorAndRethrow } from 'src/libs/error';
import Events, { extractBillingDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { useCancellation, useGetter, useOnMount, usePollingEffect } from 'src/libs/react-utils';
import * as StateHistory from 'src/libs/state-history';
import * as Utils from 'src/libs/utils';
import { isGoogleWorkspaceInfo, WorkspaceInfo, WorkspaceWrapper } from 'src/workspaces/utils';

export const groupByBillingAccountStatus = (
  billingProject: BillingProject,
  workspaces: WorkspaceInfo[]
): Record<BillingAccountStatus, Set<WorkspaceInfo>> => {
  const group = (workspace: WorkspaceInfo): BillingAccountStatus =>
    Utils.cond(
      [isAzureBillingProject(billingProject), () => 'done'],
      [
        isGoogleBillingProject(billingProject) &&
          isGoogleWorkspaceInfo(workspace) &&
          billingProject.billingAccount === workspace.billingAccount,
        () => 'done',
      ],
      [!!workspace.errorMessage, () => 'error'],
      [Utils.DEFAULT, () => 'updating']
    );

  // Return Sets to reduce the time complexity of searching for the status of any workspace from
  // O(N * W) to O(N * 1), where
  //   N is the number of statuses a billing account change could have,
  //   W is the number of workspaces in a billing project (can be very large for GP).
  // Note we need to perform this search W times for each billing project; using a set reduces time
  // complexity by an order of magnitude.
  return _.mapValues(
    (workspacesInGroup) => new Set<WorkspaceInfo>(workspacesInGroup),
    _.groupBy(group, workspaces) as Record<BillingAccountStatus, WorkspaceInfo[]>
  ) as Record<BillingAccountStatus, Set<WorkspaceInfo>>;
};

const spendReportKey = 'spend report';

interface ProjectDetailProps {
  authorizeAndLoadAccounts: () => Promise<void>;
  billingAccounts: Record<string, GoogleBillingAccount>;
  billingProject: BillingProject;
  isOwner: boolean;
  reloadBillingProject: () => Promise<unknown>;
  workspaces: WorkspaceWrapper[];
  refreshWorkspaces: () => Promise<void>;
}

const ProjectDetail = (props: ProjectDetailProps): ReactNode => {
  const {
    authorizeAndLoadAccounts,
    billingAccounts,
    billingProject,
    isOwner,
    reloadBillingProject,
    workspaces,
    refreshWorkspaces,
  } = props;

  // State
  const { query } = Nav.useRoute();
  // Rather than using a localized StateHistory store here, we use the existing `workspaceStore` value (via the `useWorkspaces` hook)

  const [projectUsers, setProjectUsers] = useState(() => StateHistory.get().projectUsers || []);
  const projectOwners: Member[] = _.filter(_.flow(_.get('roles'), _.includes(billingRoles.owner)), projectUsers);

  const [updating, setUpdating] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [tab, setTab] = useState(query.tab || 'workspaces');

  const workspacesInProject: WorkspaceInfo[] = useMemo(
    () => _.filter({ namespace: billingProject.projectName }, _.map('workspace', workspaces)),
    [billingProject, workspaces]
  );

  const groups = groupByBillingAccountStatus(billingProject, workspacesInProject);
  const billingAccountsOutOfDate = !(_.isEmpty(groups.error) && _.isEmpty(groups.updating));

  const signal = useCancellation();

  const collectUserRoles = _.flow(
    _.groupBy('email'),
    _.entries,
    _.map(([email, members]) => ({ email, roles: _.map('role', members) })),
    _.sortBy('email')
  );

  const reloadBillingProjectUsers = _.flow(
    reportErrorAndRethrow('Error loading billing project users list'),
    Utils.withBusyState(setUpdating)
  )(() => Billing(signal).listProjectUsers(billingProject.projectName).then(collectUserRoles).then(setProjectUsers));

  const removeUserFromBillingProject = _.flow(
    reportErrorAndRethrow('Error removing member from billing project'),
    Utils.withBusyState(setUpdating)
  )(_.partial(Billing().removeProjectUser, [billingProject.projectName]));

  const tabToTable = {
    workspaces: (
      <Workspaces
        billingProject={billingProject}
        workspacesInProject={workspacesInProject}
        billingAccounts={billingAccounts}
        billingAccountsOutOfDate={billingAccountsOutOfDate}
        groups={groups}
      />
    ),
    members: (
      <Members
        billingProjectName={billingProject.projectName}
        isOwner={isOwner}
        projectMembers={projectUsers}
        memberAdded={() => reloadBillingProjectUsers()}
        memberEdited={() => {
          reloadBillingProject().then(reloadBillingProjectUsers);
        }}
        deleteMember={(user) => {
          removeUserFromBillingProject(user.roles, user.email)
            .then(reloadBillingProject)
            .then(reloadBillingProjectUsers);
        }}
      />
    ),
    [spendReportKey]: (
      <SpendReport
        billingProjectName={billingProject.projectName}
        cloudPlatform={billingProject.cloudPlatform}
        viewSelected={tab === spendReportKey}
      />
    ),
  };

  const tabs = _.map(
    (key: string) => ({
      key,
      title: (
        // Rewrite the 'Members' tab to say 'Owners' if the user has the User role
        <span style={{ padding: '0 0.5rem' }}>{_.capitalize(key === 'members' && !isOwner ? 'owners' : key)}</span>
      ),
      tableName: _.lowerCase(key),
    }),
    _.filter((key: string) => key !== spendReportKey || isOwner, _.keys(tabToTable))
  );
  useEffect(() => {
    // Note: setting undefined so that falsy values don't show up at all
    const newSearch = qs.stringify(
      {
        ...query,
        tab: tab === tabs[0].key ? undefined : tab,
      },
      { addQueryPrefix: true }
    );

    if (newSearch !== Nav.history.location.search) {
      Nav.history.replace({ search: newSearch });
    }
  });

  // Lifecycle
  useOnMount(() => {
    reloadBillingProjectUsers();
  });

  useEffect(() => {
    StateHistory.update({ projectUsers });
  }, [projectUsers]);

  // usePollingEffect calls the "effect" in a while-loop and binds references once on mount.
  // As such, we need a layer of indirection to get current values.
  const getShowBillingModal = useGetter(showBillingModal);
  const getBillingAccountsOutOfDate = useGetter(billingAccountsOutOfDate);
  usePollingEffect(async () => !getShowBillingModal() && getBillingAccountsOutOfDate() && refreshWorkspaces(), {
    ms: 5000,
    leading: true,
  });

  // If the user is not an owner, projectUsers will only contain owners. If the user is not an owner, the project
  // is automatically "shared".
  const oneOwnerForSharedWorkspace = _.size(projectOwners) === 1 && (!isOwner || _.size(projectUsers) > 1);

  return (
    <>
      <div style={{ padding: '1.5rem 0 0', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            color: colors.dark(),
            fontSize: 18,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            marginLeft: '1rem',
          }}
        >
          {billingProject.projectName}
        </div>
        {isGoogleBillingProject(billingProject) && (
          <BillingAccountControls
            authorizeAndLoadAccounts={authorizeAndLoadAccounts}
            billingAccounts={billingAccounts}
            billingProject={billingProject}
            isOwner={isOwner}
            getShowBillingModal={getShowBillingModal}
            setShowBillingModal={setShowBillingModal}
            reloadBillingProject={reloadBillingProject}
            setUpdating={setUpdating}
          />
        )}
        {isAzureBillingProject(billingProject) && (
          <div style={accountLinkStyle}>
            <ExternalLink
              url={`https://portal.azure.com/#view/HubsExtension/BrowseResourcesWithTag/tagName/WLZ-ID/tagValue/${billingProject.landingZoneId}`}
              text='View project resources in Azure Portal'
              popoutSize={14}
            />
            <InfoBox style={{ marginLeft: '0.25rem' }}>
              Project resources can only be viewed when you are logged into the same tenant as the project&apos;s Azure
              subscription.
              <p style={{ marginBlockEnd: 0 }}>
                <ExternalLink
                  url={`https://portal.azure.com/#@${billingProject.managedAppCoordinates.tenantId}/resource/subscriptions/${billingProject.managedAppCoordinates.subscriptionId}/overview`}
                  text='View subscription in Azure Portal'
                />
              </p>
            </InfoBox>
          </div>
        )}
        {oneOwnerForSharedWorkspace && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '1rem 1rem 0',
              padding: '1rem',
              border: `1px solid ${colors.warning()}`,
              backgroundColor: colors.warning(0.1), // needs to be sufficient contrast with link color
            }}
          >
            <Icon style={{ color: colors.warning(), marginRight: '1ch' }} icon='warning-standard' />
            <span>
              {isOwner ? (
                <>
                  {
                    'You are the only owner of this shared billing project. Consider adding another owner to ensure someone is able to manage the billing project in case you lose access to your account. '
                  }
                  <Link
                    href='https://support.terra.bio/hc/en-us/articles/360047235151-Best-practices-for-managing-shared-funding#h_01EFCZSY6K1CEEBJDH7BCG8RBK'
                    {...Utils.newTabLinkProps}
                  >
                    More information about managing shared billing projects.
                  </Link>
                </>
              ) : (
                <>
                  {'This shared billing project has only one owner. Consider requesting '}
                  <Link href={`mailto:${projectOwners[0].email}`}>{projectOwners[0].email}</Link>
                  {
                    ' to add another owner to ensure someone is able to manage the billing project in case they lose access to their account.'
                  }
                </>
              )}
            </span>
          </div>
        )}
        <SimpleTabBar
          aria-label='project details'
          // @ts-ignore
          metricsPrefix={Events.billingProjectSelectTab}
          metricsData={extractBillingDetails(billingProject)}
          style={{ marginTop: '2rem', textTransform: 'none', padding: '0 1rem', height: '1.5rem' }}
          tabStyle={{ borderBottomWidth: 4 }}
          value={tab}
          onChange={(newTab) => {
            if (newTab === tab) {
              reloadBillingProjectUsers();
            } else {
              setTab(newTab);
            }
          }}
          tabs={tabs}
        >
          <div
            style={{
              padding: '1rem 1rem 0',
              backgroundColor: colors.light(),
              flexGrow: 1,
            }}
          >
            {tabToTable[tab]}
          </div>
        </SimpleTabBar>
      </div>
      {billingAccountsOutOfDate && (
        <BillingAccountSummary {...(_.mapValues(_.size, groups) as unknown as BillingAccountSummaryProps)} />
      )}
      {updating && <SpinnerOverlay mode='FullScreen' />}
    </>
  );
};

export default ProjectDetail;
