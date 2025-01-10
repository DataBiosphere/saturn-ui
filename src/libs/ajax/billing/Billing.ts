import { jsonBody } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import * as qs from 'qs';
import { authOpts } from 'src/auth/auth-session';
import { fetchBillingProfileManager, fetchOrchestration, fetchRawls } from 'src/libs/ajax/ajax-common';
import {
  AzureManagedAppListing,
  BillingProfile,
  BillingProject,
  BillingProjectMember,
  BillingRole,
  GoogleBillingAccount,
  SpendReport,
} from 'src/libs/ajax/billing/billing-models';
import { SupportSummary } from 'src/support/SupportResourceType';

export const Billing = (signal?: AbortSignal) => ({
  listProjects: async (): Promise<BillingProject[]> => {
    const res = await fetchRawls('billing/v2', _.merge(authOpts(), { signal }));
    return res.json();
  },

  getProject: async (projectName: string): Promise<BillingProject> => {
    const route = `billing/v2/${projectName}`;
    const res = await fetchRawls(route, _.merge(authOpts(), { signal, method: 'GET' }));
    return res.json();
  },

  adminGetProject: async (projectName: string): Promise<SupportSummary> => {
    const res = await fetchRawls(`admin/billing/${projectName}`, _.merge(authOpts(), { signal }));
    return res.json();
  },

  listAccounts: async (): Promise<GoogleBillingAccount[]> => {
    const res = await fetchRawls('user/billingAccounts?firecloudHasAccess=true', _.merge(authOpts(), { signal }));
    return res.json();
  },

  createGCPProject: async (projectName: string, billingAccount: string): Promise<Response> => {
    return await fetchRawls(
      'billing/v2',
      _.mergeAll([authOpts(), jsonBody({ projectName, billingAccount }), { signal, method: 'POST' }])
    );
  },

  createAzureProject: async (
    projectName: string,
    tenantId: string,
    subscriptionId: string,
    managedResourceGroupId: string,
    members: BillingProjectMember[],
    protectedData: boolean
  ): Promise<Response> => {
    return await fetchRawls(
      'billing/v2',
      _.mergeAll([
        authOpts(),
        jsonBody({
          projectName,
          members,
          managedAppCoordinates: { tenantId, subscriptionId, managedResourceGroupId },
          inviteUsersNotFound: true,
          protectedData,
        }),
        { signal, method: 'POST' },
      ])
    );
  },

  deleteProject: async (projectName: string): Promise<Response> => {
    const route = `billing/v2/${projectName}`;
    return await fetchRawls(route, _.merge(authOpts(), { signal, method: 'DELETE' }));
  },

  changeBillingAccount: async ({
    billingProjectName,
    newBillingAccountName,
  }: {
    billingProjectName: string;
    newBillingAccountName: string;
  }): Promise<BillingProject> => {
    return await fetchOrchestration(
      `api/billing/v2/${billingProjectName}/billingAccount`,
      _.mergeAll([authOpts(), { signal, method: 'PUT' }, jsonBody({ billingAccount: newBillingAccountName })])
    );
  },

  removeBillingAccount: async ({ billingProjectName }: { billingProjectName: string }): Promise<Response> => {
    return await fetchOrchestration(
      `api/billing/v2/${billingProjectName}/billingAccount`,
      _.merge(authOpts(), { signal, method: 'DELETE' })
    );
  },

  updateSpendConfiguration: async ({
    billingProjectName,
    datasetGoogleProject,
    datasetName,
  }: {
    billingProjectName: string;
    datasetGoogleProject: string;
    datasetName: string;
  }): Promise<Response> => {
    return await fetchOrchestration(
      `api/billing/v2/${billingProjectName}/spendReportConfiguration`,
      _.mergeAll([authOpts(), { signal, method: 'PUT' }, jsonBody({ datasetGoogleProject, datasetName })])
    );
  },

  /**
   * Returns the spend report for the given billing project, from 12 AM on the startDate to 11:59 PM on the endDate (UTC). Spend details by
   * Workspace are included.
   *
   * @param billingProjectName
   * @param startDate, a string of the format YYYY-MM-DD, representing the start date of the report.
   * @param endDate a string of the format YYYY-MM-DD, representing the end date of the report.
   * @param aggregationKeys a list of strings indicating how to aggregate spend data. subAggregation can be requested by separating keys with '~' e.g. 'Workspace~Category'
   * @returns {Promise<*>}
   */
  getSpendReport: async ({
    billingProjectName,
    startDate,
    endDate,
    aggregationKeys,
  }: {
    billingProjectName: string;
    startDate: string;
    endDate: string;
    aggregationKeys: string[];
  }): Promise<SpendReport> => {
    const res = await fetchRawls(
      `billing/v2/${billingProjectName}/spendReport?${qs.stringify(
        { startDate, endDate, aggregationKey: aggregationKeys },
        { arrayFormat: 'repeat' }
      )}`,
      _.merge(authOpts(), { signal })
    );
    return res.json();
  },

  /**
   * Returns a spend report for each workspace the user has owner permission on, from 12 AM on the startDate to 11:59 PM on the endDate (UTC). Spend details by
   * Workspace are included.
   *
   * @param startDate, a string of the format YYYY-MM-DD, representing the start date of the report.
   * @param endDate a string of the format YYYY-MM-DD, representing the end date of the report.
   * @param pageSize how many workspaces to include in each page of the report
   * @param offset the index of the first workspace to include in the report
   * @returns {Promise<*>}
   */
  getCrossBillingSpendReport: async ({
    startDate,
    endDate,
    pageSize,
    offset,
  }: {
    startDate: string;
    endDate: string;
    pageSize: number;
    offset: number;
  }): Promise<SpendReport> => {
    const res = await fetchRawls(
      `billing/v2/spendReport?${qs.stringify({ startDate, endDate, pageSize, offset }, { arrayFormat: 'repeat' })}`,
      _.merge(authOpts(), { signal })
    );
    return res.json();
  },

  listProjectUsers: async (projectName: string): Promise<BillingProjectMember[]> => {
    const res = await fetchRawls(`billing/v2/${projectName}/members`, _.merge(authOpts(), { signal }));
    return res.json();
  },

  addProjectUsers: async (projectName: string, roles: BillingRole[], emails: string[]): Promise<Response> => {
    const userRoles: BillingProjectMember[] = _.flatMap((email) => roles.map((role) => ({ email, role })), emails);

    return await fetchRawls(
      `billing/v2/${projectName}/members?inviteUsersNotFound=true`,
      _.mergeAll([authOpts(), jsonBody({ membersToAdd: userRoles, membersToRemove: [] }), { signal, method: 'PATCH' }])
    );
  },

  removeProjectUser: (projectName: string, roles: BillingRole[], email: string): Promise<void[]> => {
    const removeRole = (role: BillingRole): Promise<void> =>
      fetchRawls(
        `billing/v2/${projectName}/members/${role}/${encodeURIComponent(email)}`,
        _.merge(authOpts(), { signal, method: 'DELETE' })
      );

    return Promise.all(_.map(removeRole, roles));
  },

  changeUserRoles: async (
    projectName: string,
    email: string,
    oldRoles: BillingRole[],
    newRoles: BillingRole[]
  ): Promise<void[] | void> => {
    const billing = Billing();
    if (!_.isEqual(oldRoles, newRoles)) {
      await billing.addProjectUsers(projectName, _.difference(newRoles, oldRoles), [email]);
      return billing.removeProjectUser(projectName, _.difference(oldRoles, newRoles), email);
    }
  },

  listAzureManagedApplications: async (
    subscriptionId: string,
    includeAssignedApplications: boolean
  ): Promise<{ managedApps: AzureManagedAppListing[] }> => {
    const response = await fetchBillingProfileManager(
      `azure/v1/managedApps?azureSubscriptionId=${subscriptionId}&includeAssignedApplications=${includeAssignedApplications}`,
      _.merge(authOpts(), { signal })
    );
    return response.json();
  },

  getBillingProfile: (billingProfileId: string): Promise<BillingProfile> => {
    return fetchBillingProfileManager(`profiles/v1/${billingProfileId}`, _.merge(authOpts(), { signal })).then((r) =>
      r.json()
    );
  },
});

export type BillingContract = ReturnType<typeof Billing>;

export const canUseWorkspaceProject = async ({
  canCompute,
  workspace: { namespace },
}: {
  canCompute: boolean;
  workspace: { namespace: string };
}): Promise<boolean> => {
  return (
    canCompute ||
    _.some(
      ({ projectName, roles }) => projectName === namespace && _.includes('Owner', roles),
      await Billing().listProjects()
    )
  );
};
