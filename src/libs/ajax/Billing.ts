import _ from 'lodash/fp';
import * as qs from 'qs';
import { AzureManagedAppCoordinates } from 'src/billing-logic/AzureManagedAppCoordinates';
import { BillingProject, BillingProjectMember, BillingRole } from 'src/billing-logic/BillingProject';
import { GoogleBillingAccount } from 'src/billing-logic/GoogleBillingAccount';
import {
  authOpts,
  fetchBillingProfileManager,
  fetchOrchestration,
  fetchRawls,
  jsonBody,
} from 'src/libs/ajax/ajax-common';

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

  listAccounts: async (): Promise<GoogleBillingAccount[]> => {
    const res = await fetchRawls('user/billingAccounts?firecloudHasAccess=true', _.merge(authOpts(), { signal }));
    return res.json();
  },

  createGCPProject: async (projectName: string, billingAccount: string): Promise<void> => {
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
  ): Promise<void> => {
    // members: an array of {email: string, role: string}
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

  deleteProject: async (projectName: string): Promise<void> => {
    const route = `billing/v2/${projectName}`;
    const res = await fetchRawls(route, _.merge(authOpts(), { signal, method: 'DELETE' }));
    return res;
  },

  changeBillingAccount: async ({
    billingProjectName,
    newBillingAccountName,
  }: {
    billingProjectName: string;
    newBillingAccountName: string;
  }): Promise<BillingProject> => {
    const res = await fetchOrchestration(
      `api/billing/v2/${billingProjectName}/billingAccount`,
      _.mergeAll([authOpts(), { signal, method: 'PUT' }, jsonBody({ billingAccount: newBillingAccountName })])
    );
    return res;
  },

  removeBillingAccount: async ({ billingProjectName }: { billingProjectName: string }): Promise<void> => {
    const res = await fetchOrchestration(
      `api/billing/v2/${billingProjectName}/billingAccount`,
      _.merge(authOpts(), { signal, method: 'DELETE' })
    );
    return res;
  },

  updateSpendConfiguration: async ({ billingProjectName, datasetGoogleProject, datasetName }) => {
    const res = await fetchOrchestration(
      `api/billing/v2/${billingProjectName}/spendReportConfiguration`,
      _.mergeAll([authOpts(), { signal, method: 'PUT' }, jsonBody({ datasetGoogleProject, datasetName })])
    );
    return res;
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
  getSpendReport: async ({ billingProjectName, startDate, endDate, aggregationKeys }) => {
    const res = await fetchRawls(
      `billing/v2/${billingProjectName}/spendReport?${qs.stringify(
        { startDate, endDate, aggregationKey: aggregationKeys },
        { arrayFormat: 'repeat' }
      )}`,
      _.merge(authOpts(), { signal })
    );
    return res.json();
  },

  listProjectUsers: async (projectName: string): Promise<BillingProjectMember[]> => {
    const res = await fetchRawls(`billing/v2/${projectName}/members`, _.merge(authOpts(), { signal }));
    return res.json();
  },

  addProjectUser: async (projectName: string, roles: BillingRole[], email: string): Promise<void> => {
    let userRoles: BillingProjectMember[] = [];
    roles.forEach((role) => {
      userRoles = _.concat(userRoles, [{ email, role }]);
    });
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
      await billing.addProjectUser(projectName, _.difference(newRoles, oldRoles), email);
      return billing.removeProjectUser(projectName, _.difference(oldRoles, newRoles), email);
    }
  },

  listAzureManagedApplications: async (
    subscriptionId: string,
    includeAssignedApplications: boolean
  ): Promise<{ managedApps: (AzureManagedAppCoordinates & { assigned: boolean })[] }> => {
    const response = await fetchBillingProfileManager(
      `azure/v1/managedApps?azureSubscriptionId=${subscriptionId}&includeAssignedApplications=${includeAssignedApplications}`,
      _.merge(authOpts(), { signal })
    );
    return response.json();
  },
});

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
