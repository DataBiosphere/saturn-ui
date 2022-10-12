import _ from 'lodash/fp'
import * as qs from 'qs'
import {
  appIdentifier, authOpts, checkRequesterPaysError, fetchAgora, fetchBillingProfileManager, fetchBond, fetchCatalog,
  fetchDataRepo, fetchDockstore,
  fetchDrsHub,
  fetchEcm, fetchGoogleForms,
  fetchMartha, fetchOk, fetchOrchestration, fetchRawls, fetchRex, fetchSam, jsonBody, withRetryOnError, withUrlPrefix
} from 'src/libs/ajax/ajax-common'
import { Apps } from 'src/libs/ajax/Apps'
import { AzureStorage } from 'src/libs/ajax/AzureStorage'
import { Disks } from 'src/libs/ajax/Disks'
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage'
import { Metrics } from 'src/libs/ajax/Metrics'
import { Resources } from 'src/libs/ajax/Resources'
import { Runtimes } from 'src/libs/ajax/Runtimes'
import { getUser } from 'src/libs/auth'
import { getConfig } from 'src/libs/config'
import { withErrorIgnoring } from 'src/libs/error'
import { knownBucketRequesterPaysStatuses, requesterPaysProjectStore, workspaceStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'


window.ajaxOverrideUtils = {
  mapJsonBody: _.curry((fn, wrappedFetch) => async (...args) => {
    const res = await wrappedFetch(...args)
    return new Response(JSON.stringify(fn(await res.json())), res)
  }),
  makeError: _.curry(({ status, frequency = 1 }, wrappedFetch) => (...args) => {
    return Math.random() < frequency ?
      Promise.resolve(new Response('Instrumented error', { status })) :
      wrappedFetch(...args)
  }),
  makeSuccess: body => _wrappedFetch => () => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

// %23 = '#', %2F = '/'
const dockstoreMethodPath = ({ path, isTool }) => `api/ga4gh/v1/tools/${isTool ? '' : '%23workflow%2F'}${encodeURIComponent(path)}/versions`

/**
 * Only use this if the user has write access to the workspace to avoid proliferation of service accounts in projects containing public workspaces.
 * If we want to fetch a SA token for read access, we must use a "default" SA instead (api/google/user/petServiceAccount/token).
 */
const getServiceAccountToken = Utils.memoizeAsync(async (googleProject, token) => {
  const scopes = ['https://www.googleapis.com/auth/devstorage.full_control']
  const res = await fetchSam(
    `api/google/v1/user/petServiceAccount/${googleProject}/token`,
    _.mergeAll([authOpts(token), jsonBody(scopes), { method: 'POST' }])
  )
  return res.json()
}, { expires: 1000 * 60 * 30, keyFn: (...args) => JSON.stringify(args) })

export const saToken = googleProject => getServiceAccountToken(googleProject, getUser().token)

const getFirstTimeStamp = Utils.memoizeAsync(async token => {
  const res = await fetchRex('firstTimestamps/record', _.mergeAll([authOpts(token), { method: 'POST' }]))
  return res.json()
}, { keyFn: (...args) => JSON.stringify(args) })

const getSnapshotEntityMetadata = Utils.memoizeAsync(async (token, workspaceNamespace, workspaceName, googleProject, dataReference) => {
  const res = await fetchRawls(`workspaces/${workspaceNamespace}/${workspaceName}/entities?billingProject=${googleProject}&dataReference=${dataReference}`, authOpts(token))
  return res.json()
}, { keyFn: (...args) => JSON.stringify(args) })

//TODO: this is a weird util method that calls an api... should be refactored so its not a circular utility
export const canUseWorkspaceProject = async ({ canCompute, workspace: { namespace } }) => {
  return canCompute || _.some(
    ({ projectName, roles }) => projectName === namespace && _.includes('Owner', roles),
    await Ajax().Billing.listProjects()
  )
}

/*
 * Detects errors due to requester pays buckets, and adds the current workspace's billing
 * project if the user has access, retrying the request once if necessary.
 */
const withRequesterPays = wrappedFetch => (url, ...args) => {
  const bucket = /\/b\/([^/?]+)[/?]/.exec(url)[1]
  const workspace = workspaceStore.get()

  const getUserProject = async () => {
    if (!requesterPaysProjectStore.get() && workspace && await canUseWorkspaceProject(workspace)) {
      requesterPaysProjectStore.set(workspace.workspace.googleProject)
    }
    return requesterPaysProjectStore.get()
  }

  const tryRequest = async () => {
    const knownRequesterPays = knownBucketRequesterPaysStatuses.get()[bucket]
    try {
      const userProject = (knownRequesterPays && await getUserProject()) || undefined
      const res = await wrappedFetch(Utils.mergeQueryParams({ userProject }, url), ...args)
      !knownRequesterPays && knownBucketRequesterPaysStatuses.update(_.set(bucket, false))
      return res
    } catch (error) {
      if (knownRequesterPays === false) {
        throw error
      } else {
        const newResponse = await checkRequesterPaysError(error)
        if (newResponse.requesterPaysError && !knownRequesterPays) {
          knownBucketRequesterPaysStatuses.update(_.set(bucket, true))
          if (await getUserProject()) {
            return tryRequest()
          }
        }
        throw newResponse
      }
    }
  }
  return tryRequest()
}

// requesterPaysError may be set on responses from requests to the GCS API that are wrapped in withRequesterPays.
// requesterPaysError is true if the request requires a user project for billing the request to. Such errors
// are not transient and the request should not be retried.
export const fetchBuckets = _.flow(withRequesterPays, withRetryOnError(error => Boolean(error.requesterPaysError)), withUrlPrefix('https://storage.googleapis.com/'))(fetchOk)

const User = signal => ({
  getStatus: async () => {
    const res = await fetchOk(`${getConfig().samUrlRoot}/register/user/v2/self/info`, _.mergeAll([authOpts(), { signal }, appIdentifier]))
    return res.json()
  },

  profile: {
    get: async () => {
      const res = await fetchOrchestration('register/profile', _.merge(authOpts(), { signal }))
      return res.json()
    },

    //We are not calling Thurloe directly because free credits logic was in orchestration
    set: keysAndValues => {
      const blankProfile = {
        firstName: 'N/A',
        lastName: 'N/A',
        title: 'N/A',
        institute: 'N/A',
        institutionalProgram: 'N/A',
        programLocationCity: 'N/A',
        programLocationState: 'N/A',
        programLocationCountry: 'N/A',
        pi: 'N/A',
        nonProfitStatus: 'N/A'
      }
      return fetchOrchestration(
        'register/profile',
        _.mergeAll([authOpts(), jsonBody(_.merge(blankProfile, keysAndValues)), { signal, method: 'POST' }])
      )
    },

    setPreferences: body => {
      return fetchOrchestration('api/profile/preferences', _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]))
    },

    preferLegacyFirecloud: () => {
      return fetchOrchestration('api/profile/terra', _.mergeAll([authOpts(), { signal, method: 'DELETE' }]))
    }
  },

  getProxyGroup: async email => {
    const res = await fetchOrchestration(`api/proxyGroup/${encodeURIComponent(email)}`, _.merge(authOpts(), { signal }))
    return res.json()
  },

  getTosAccepted: async () => {
    try {
      const res = await fetchSam('register/user/v1/termsofservice/status', _.merge(authOpts(), { signal }))
      return res.json()
    } catch (error) {
      if (error.status === 404) {
        return null
      } else if (error.status === 403) {
        return false
      } else {
        throw error
      }
    }
  },

  getTos: async () => {
    const response = await fetchSam('tos/text', _.merge(authOpts(), { signal }))
    return response.text()
  },

  acceptTos: async () => {
    try {
      await fetchSam(
        'register/user/v1/termsofservice',
        _.mergeAll([authOpts(), { signal, method: 'POST' }, jsonBody('app.terra.bio/#terms-of-service')])
      )
    } catch (error) {
      if (error.status !== 404) {
        throw error
      }
    }
  },

  // If you are making changes to the Support Request Modal, make sure you test the following:
  // 1. Submit a ticket via Terra while signed in and signed out
  // 2. Check the tickets are generated on Zendesk
  // 3. Reply internally (as a Light Agent) and make sure an email is not sent
  // 4. Reply externally (ask one of the Comms team with Full Agent access) and make sure you receive an email
  createSupportRequest: ({ name, email, currUrl, subject, type, description, attachmentToken, emailAgreed, clinicalUser }) => {
    return fetchOk(
      'https://support.terra.bio/api/v2/requests.json',
      _.merge({ signal, method: 'POST' }, jsonBody({
        request: {
          requester: { name, email },
          subject,
          // BEWARE changing the following ids or values! If you change them then you must thoroughly test.
          custom_fields: [
            { id: 360012744452, value: type },
            { id: 360007369412, value: description },
            { id: 360012744292, value: name },
            { id: 360012782111, value: email },
            { id: 360018545031, value: emailAgreed },
            { id: 360027463271, value: clinicalUser }
          ],
          comment: {
            body: `${description}\n\n------------------\nSubmitted from: ${currUrl}`,
            uploads: [`${attachmentToken}`]
          }
        }
      })))
  },

  uploadAttachment: async file => {
    const res = await fetchOk(`https://support.terra.bio/api/v2/uploads?filename=${file.name}`, {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': 'application/binary'
      }
    })
    return (await res.json()).upload
  },

  firstTimestamp: () => {
    return getFirstTimeStamp(getUser().token)
  },

  // UX is testing using AppCues. If experiment is successful, all NpsSurvey code can be deleted.
  lastNpsResponse: async () => {
    const res = await fetchRex('npsResponses/lastTimestamp', _.merge(authOpts(), { signal }))
    return res.json()
  },

  // UX is testing using AppCues. If experiment is successful, all NpsSurvey code can be deleted.
  postNpsResponse: body => {
    return fetchRex('npsResponses/create', _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]))
  },

  getNihStatus: async () => {
    try {
      const res = await fetchOrchestration('api/nih/status', _.merge(authOpts(), { signal }))
      return res.json()
    } catch (error) {
      if (error.status === 404) {
        return {}
      } else {
        throw error
      }
    }
  },

  linkNihAccount: async token => {
    const res = await fetchOrchestration('api/nih/callback', _.mergeAll([authOpts(), jsonBody({ jwt: token }), { signal, method: 'POST' }]))
    return res.json()
  },

  unlinkNihAccount: async () => {
    await fetchOrchestration('api/nih/account', _.mergeAll([authOpts(), { signal, method: 'DELETE' }]))
  },

  getFenceStatus: async provider => {
    try {
      const res = await fetchBond(`api/link/v1/${provider}`, _.merge(authOpts(), { signal }))
      return res.json()
    } catch (error) {
      if (error.status === 404) {
        return {}
      } else {
        throw error
      }
    }
  },

  getFenceAuthUrl: async (provider, redirectUri) => {
    const queryParams = {
      scopes: ['openid', 'google_credentials', 'data', 'user'],
      redirect_uri: redirectUri,
      state: btoa(JSON.stringify({ provider }))
    }
    const res = await fetchBond(`api/link/v1/${provider}/authorization-url?${qs.stringify(queryParams, { indices: false })}`, _.merge(authOpts(), { signal }))
    return res.json()
  },

  linkFenceAccount: async (provider, authCode, redirectUri, state) => {
    const queryParams = {
      oauthcode: authCode,
      redirect_uri: redirectUri,
      state
    }
    const res = await fetchBond(`api/link/v1/${provider}/oauthcode?${qs.stringify(queryParams)}`, _.merge(authOpts(), { signal, method: 'POST' }))
    return res.json()
  },

  unlinkFenceAccount: provider => {
    return fetchBond(`api/link/v1/${provider}`, _.merge(authOpts(), { signal, method: 'DELETE' }))
  },

  externalAccount: provider => {
    const root = `api/oidc/v1/${provider}`
    const queryParams = {
      scopes: ['openid', 'email', 'ga4gh_passport_v1'],
      redirectUri: `${window.location.hostname === 'localhost' ? getConfig().devUrlRoot : window.location.origin}/ecm-callback`
    }

    return {
      get: async () => {
        try {
          const res = await fetchEcm(root, _.merge(authOpts(), { signal }))
          return res.json()
        } catch (error) {
          if (error.status === 404) {
            return null
          } else {
            throw error
          }
        }
      },

      getAuthUrl: async () => {
        const res = await fetchEcm(`${root}/authorization-url?${qs.stringify(queryParams, { indices: false })}`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      getPassport: async () => {
        const res = await fetchEcm(`${root}/passport`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      linkAccount: async (oauthcode, state) => {
        const res = await fetchEcm(`${root}/oauthcode?${qs.stringify({ ...queryParams, oauthcode, state }, { indices: false })}`, _.merge(authOpts(), { signal, method: 'POST' }))
        return res.json()
      },

      unlink: () => {
        return fetchEcm(root, _.merge(authOpts(), { signal, method: 'DELETE' }))
      }
    }
  },

  isUserRegistered: async email => {
    try {
      await fetchSam(`api/users/v1/${encodeURIComponent(email)}`, _.merge(authOpts(), { signal, method: 'GET' }))
    } catch (error) {
      if (error.status === 404) {
        return false
      } else {
        throw error
      }
    }
    return true
  },

  inviteUser: email => {
    return fetchSam(`api/users/v1/invite/${encodeURIComponent(email)}`, _.merge(authOpts(), { signal, method: 'POST' }))
  }
})

const Groups = signal => ({
  list: async () => {
    const res = await fetchSam('api/groups/v1', _.merge(authOpts(), { signal }))
    return res.json()
  },

  group: groupName => {
    const root = `api/groups/v1/${groupName}`
    const resourceRoot = `api/resources/v1/managed-group/${groupName}`

    const addRole = (role, email) => {
      return fetchSam(`${root}/${role}/${encodeURIComponent(email)}`, _.merge(authOpts(), { signal, method: 'PUT' }))
    }

    const removeRole = (role, email) => {
      return fetchSam(`${root}/${role}/${encodeURIComponent(email)}`, _.merge(authOpts(), { signal, method: 'DELETE' }))
    }

    return {
      create: () => {
        return fetchSam(root, _.merge(authOpts(), { signal, method: 'POST' }))
      },

      delete: () => {
        return fetchSam(root, _.merge(authOpts(), { signal, method: 'DELETE' }))
      },

      listAdmins: async () => {
        const res = await fetchSam(`${root}/admin`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      listMembers: async () => {
        const res = await fetchSam(`${root}/member`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      addUser: (roles, email) => {
        return Promise.all(_.map(role => addRole(role, email), roles))
      },

      removeUser: (roles, email) => {
        return Promise.all(_.map(role => removeRole(role, email), roles))
      },

      changeUserRoles: async (email, oldRoles, newRoles) => {
        if (!_.isEqual(oldRoles, newRoles)) {
          await Promise.all(_.map(role => addRole(role, email), _.difference(newRoles, oldRoles)))
          return Promise.all(_.map(role => removeRole(role, email), _.difference(oldRoles, newRoles)))
        }
      },

      requestAccess: async () => {
        await fetchSam(`${root}/requestAccess`, _.merge(authOpts(), { signal, method: 'POST' }))
      },

      getPolicy: async policyName => {
        const res = await fetchSam(`${resourceRoot}/policies/${policyName}/public`, _.merge(authOpts(), { signal }))
        return await res.json()
      },

      setPolicy: (policyName, value) => {
        return fetchSam(`${resourceRoot}/policies/${policyName}/public`, _.mergeAll([authOpts(), { signal, method: 'PUT' }, jsonBody(value)]))
      },

      isMember: async () => {
        const res = await fetchSam(`${resourceRoot}/action/use`, _.merge(authOpts(), { signal }))
        return res.json()
      }
    }
  }
})

const Billing = signal => ({
  listProjects: async () => {
    const res = await fetchRawls('billing/v2', _.merge(authOpts(), { signal }))
    return res.json()
  },

  getProject: async projectName => {
    const route = `billing/v2/${projectName}`
    const res = await fetchRawls(route, _.merge(authOpts(), { signal, method: 'GET' }))
    return res.json()
  },

  listAccounts: async () => {
    const res = await fetchRawls('user/billingAccounts?firecloudHasAccess=true', _.merge(authOpts(), { signal }))
    return res.json()
  },

  createGCPProject: async (projectName, billingAccount) => {
    return await fetchRawls('billing/v2',
      _.mergeAll([authOpts(), jsonBody({ projectName, billingAccount }), { signal, method: 'POST' }])
    )
  },

  createAzureProject: async (projectName, tenantId, subscriptionId, managedResourceGroupId) => {
    return await fetchRawls('billing/v2',
      _.mergeAll([authOpts(), jsonBody(
        { projectName, managedAppCoordinates: { tenantId, subscriptionId, managedResourceGroupId } }
      ),
      { signal, method: 'POST' }])
    )
  },

  deleteProject: async projectName => {
    const route = `billing/v2/${projectName}`
    const res = await fetchRawls(route, _.merge(authOpts(), { signal, method: 'DELETE' }))
    return res
  },

  changeBillingAccount: async ({ billingProjectName, newBillingAccountName }) => {
    const res = await fetchOrchestration(`api/billing/v2/${billingProjectName}/billingAccount`,
      _.mergeAll([
        authOpts(), { signal, method: 'PUT' },
        jsonBody({ billingAccount: newBillingAccountName })
      ]))
    return res
  },

  removeBillingAccount: async ({ billingProjectName }) => {
    const res = await fetchOrchestration(`api/billing/v2/${billingProjectName}/billingAccount`,
      _.merge(authOpts(), { signal, method: 'DELETE' }))
    return res
  },

  updateSpendConfiguration: async ({ billingProjectName, datasetGoogleProject, datasetName }) => {
    const res = await fetchOrchestration(`api/billing/v2/${billingProjectName}/spendReportConfiguration`,
      _.mergeAll([
        authOpts(), { signal, method: 'PUT' },
        jsonBody({ datasetGoogleProject, datasetName })
      ]))
    return res
  },

  /**
   * Returns the spend report for the given billing project, from 12 AM on the startDate to 11:59 PM on the endDate (UTC). Spend details by
   * Workspace are included.
   *
   * @param billingProjectName
   * @param startDate, a string of the format YYYY-MM-DD, representing the start date of the report.
   * @param endDate a string of the format YYYY-MM-DD, representing the end date of the report.
   * @returns {Promise<*>}
   */
  getSpendReport: async ({ billingProjectName, startDate, endDate }) => {
    const res = await fetchRawls(
      `billing/v2/${billingProjectName}/spendReport?${qs.stringify({ startDate, endDate, aggregationKey: 'Workspace~Category' })}&${qs.stringify({ aggregationKey: 'Category' })}`,
      _.merge(authOpts(), { signal })
    )
    return res.json()
  },

  listProjectUsers: async projectName => {
    const res = await fetchRawls(`billing/v2/${projectName}/members`, _.merge(authOpts(), { signal }))
    return res.json()
  },

  addProjectUser: (projectName, roles, email) => {
    const addRole = role => fetchRawls(
      `billing/v2/${projectName}/members/${role}/${encodeURIComponent(email)}`,
      _.merge(authOpts(), { signal, method: 'PUT' })
    )

    return Promise.all(_.map(addRole, roles))
  },

  removeProjectUser: (projectName, roles, email) => {
    const removeRole = role => fetchRawls(
      `billing/v2/${projectName}/members/${role}/${encodeURIComponent(email)}`,
      _.merge(authOpts(), { signal, method: 'DELETE' })
    )

    return Promise.all(_.map(removeRole, roles))
  },

  changeUserRoles: async (projectName, email, oldRoles, newRoles) => {
    const billing = Billing()
    if (!_.isEqual(oldRoles, newRoles)) {
      await billing.addProjectUser(projectName, _.difference(newRoles, oldRoles), email)
      return billing.removeProjectUser(projectName, _.difference(oldRoles, newRoles), email)
    }
  },

  listAzureManagedApplications: async subscriptionId => {
    const response = await fetchBillingProfileManager(`azure/v1/managedApps?azureSubscriptionId=${subscriptionId}`,
      _.merge(authOpts(), { signal }))
    return response.json()
  }
})

const attributesUpdateOps = _.flow(
  _.toPairs,
  _.flatMap(([k, v]) => {
    return _.isArray(v) ?
      [
        { op: 'RemoveAttribute', attributeName: k },
        ...(_.isObject(v[0]) ?
          [{ op: 'CreateAttributeEntityReferenceList', attributeListName: k }] :
          [{ op: 'CreateAttributeValueList', attributeName: k }]
        ),
        ..._.map(x => ({ op: 'AddListMember', attributeListName: k, newMember: x }), v)
      ] :
      [{ op: 'AddUpdateAttribute', attributeName: k, addUpdateAttribute: v }]
  })
)

const CromIAM = signal => ({
  callCacheDiff: async (thisWorkflow, thatWorkflow) => {
    const { workflowId: thisWorkflowId, callFqn: thisCallFqn, index: thisIndex } = thisWorkflow
    const { workflowId: thatWorkflowId, callFqn: thatCallFqn, index: thatIndex } = thatWorkflow

    const params = {
      workflowA: thisWorkflowId,
      callA: thisCallFqn,
      indexA: (thisIndex !== -1) ? thisIndex : undefined,
      workflowB: thatWorkflowId,
      callB: thatCallFqn,
      indexB: (thatIndex !== -1) ? thatIndex : undefined
    }
    const res = await fetchOrchestration(`api/workflows/v1/callcaching/diff?${qs.stringify(params)}`, _.merge(authOpts(), { signal }))
    return res.json()
  },

  workflowMetadata: async (workflowId, includeKey, excludeKey) => {
    const res = await fetchOrchestration(`api/workflows/v1/${workflowId}/metadata?${qs.stringify({ includeKey, excludeKey }, { arrayFormat: 'repeat' })}`, _.merge(authOpts(), { signal }))
    return res.json()
  }
})

const Workspaces = signal => ({
  list: async fields => {
    const res = await fetchRawls(`workspaces?${qs.stringify({ fields }, { arrayFormat: 'comma' })}`, _.merge(authOpts(), { signal }))
    return res.json()
  },

  create: async body => {
    const res = await fetchRawls('workspaces', _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]))
    return res.json()
  },

  getShareLog: async () => {
    const res = await fetchOrchestration('api/sharelog/sharees?shareType=workspace', _.merge(authOpts(), { signal }))
    return res.json()
  },

  getTags: async (tag, limit) => {
    const params = { q: tag }
    if (limit) {
      params.limit = limit
    }
    const res = await fetchRawls(`workspaces/tags?${qs.stringify(params)}`, _.merge(authOpts(), { signal }))
    return res.json()
  },

  workspace: (namespace, name) => {
    const root = `workspaces/${namespace}/${name}`
    const mcPath = `${root}/methodconfigs`

    return {
      checkBucketReadAccess: () => {
        return fetchRawls(`${root}/checkBucketReadAccess`, _.merge(authOpts(), { signal }))
      },

      checkBucketAccess: async (googleProject, bucket, accessLevel) => {
        // Protect against asking for a project-specific pet service account token if user cannot write to the workspace
        if (!Utils.canWrite(accessLevel)) {
          return false
        }

        const res = await fetchBuckets(`storage/v1/b/${bucket}?fields=billing`,
          _.merge(authOpts(await saToken(googleProject)), { signal }))
        return res.json()
      },

      checkBucketLocation: async (googleProject, bucket) => {
        const res = await fetchBuckets(`storage/v1/b/${bucket}?fields=location%2ClocationType`,
          _.merge(authOpts(await saToken(googleProject)), { signal }))

        return res.json()
      },

      details: async fields => {
        const res = await fetchRawls(`${root}?${qs.stringify({ fields }, { arrayFormat: 'comma' })}`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      getAcl: async () => {
        const res = await fetchRawls(`${root}/acl`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      updateAcl: async (aclUpdates, inviteNew = true) => {
        const res = await fetchOrchestration(`api/${root}/acl?inviteUsersNotFound=${inviteNew}`,
          _.mergeAll([authOpts(), jsonBody(aclUpdates), { signal, method: 'PATCH' }]))
        return res.json()
      },

      lock: async () => {
        return await fetchRawls(`${root}/lock`, _.merge(authOpts(), { signal, method: 'PUT' }))
      },

      unlock: async () => {
        return await fetchRawls(`${root}/unlock`, _.merge(authOpts(), { signal, method: 'PUT' }))
      },

      listMethodConfigs: async (allRepos = true) => {
        const res = await fetchRawls(`${mcPath}?allRepos=${allRepos}`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      importMethodConfigFromDocker: payload => {
        return fetchRawls(mcPath, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }]))
      },

      methodConfig: (configNamespace, configName) => {
        const path = `${mcPath}/${configNamespace}/${configName}`

        return {
          get: async () => {
            const res = await fetchRawls(path, _.merge(authOpts(), { signal }))
            return res.json()
          },

          save: async payload => {
            const res = await fetchRawls(path, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }]))
            return res.json()
          },

          copyTo: async ({ destConfigNamespace, destConfigName, workspaceName }) => {
            const payload = {
              source: { namespace: configNamespace, name: configName, workspaceName: { namespace, name } },
              destination: { namespace: destConfigNamespace, name: destConfigName, workspaceName }
            }
            const res = await fetchRawls('methodconfigs/copy', _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }]))
            return res.json()
          },

          validate: async () => {
            const res = await fetchRawls(`${path}/validate`, _.merge(authOpts(), { signal }))
            return res.json()
          },

          launch: async payload => {
            const res = await fetchRawls(`${root}/submissions`, _.mergeAll([
              authOpts(),
              jsonBody({
                ...payload,
                methodConfigurationNamespace: configNamespace,
                methodConfigurationName: configName
              }),
              { signal, method: 'POST' }
            ]))
            return res.json()
          },

          delete: () => {
            return fetchRawls(path, _.merge(authOpts(), { signal, method: 'DELETE' }))
          }
        }
      },

      listSubmissions: async () => {
        const res = await fetchRawls(`${root}/submissions`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      listSnapshots: async (limit, offset) => {
        const res = await fetchRawls(`${root}/snapshots/v2?offset=${offset}&limit=${limit}`, _.merge(authOpts(), { signal }))
        // The list snapshots endpoint returns a "snapshot" field that should really be named "snapshotId". Ideally, this should be fixed in the
        // backend, but we've sequestered it here for now.
        return _.update('gcpDataRepoSnapshots', _.map(_.update('attributes', a => ({ ...a, snapshotId: a.snapshot }))), await res.json())
      },

      snapshot: snapshotId => {
        const snapshotPath = `${root}/snapshots/v2/${snapshotId}`

        return {
          details: async () => {
            const res = await fetchRawls(snapshotPath, _.merge(authOpts(), { signal }))
            return res.json()
          },

          update: updateInfo => {
            return fetchRawls(snapshotPath, _.mergeAll([
              authOpts(),
              jsonBody(updateInfo),
              { signal, method: 'PATCH' }
            ]))
          },

          delete: () => {
            return fetchRawls(snapshotPath, _.merge(authOpts(), { signal, method: 'DELETE' }))
          }
        }
      },

      submission: submissionId => {
        const submissionPath = `${root}/submissions/${submissionId}`

        return {
          get: async () => {
            const res = await fetchRawls(submissionPath, _.merge(authOpts(), { signal }))
            return res.json()
          },

          getConfiguration: async () => {
            const res = await fetchRawls(`${submissionPath}/configuration`, _.merge(authOpts(), { signal }))
            return res.json()
          },

          abort: () => {
            return fetchRawls(submissionPath, _.merge(authOpts(), { signal, method: 'DELETE' }))
          },

          updateUserComment: userComment => {
            const payload = { userComment }
            return fetchRawls(submissionPath, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }]))
          },

          // NB: This could one day perhaps redirect to CromIAM's 'workflow' like:
          // workflow: workflowId => Ajax(signal).CromIAM.workflow(workflowId)
          // But: Because of the slowness of asking via CromIAM, that's probably a non-starter for right now.
          workflow: workflowId => {
            return {
              metadata: async ({ includeKey, excludeKey }) => {
                const res = await fetchRawls(`${submissionPath}/workflows/${workflowId}?${qs.stringify({
                  includeKey,
                  excludeKey
                }, { arrayFormat: 'repeat' })}`, _.merge(authOpts(), { signal }))
                return res.json()
              },

              outputs: () => fetchRawls(`${submissionPath}/workflows/${workflowId}/outputs`, _.merge(authOpts(), { signal })).then(r => r.json())
            }
          }
        }
      },

      delete: () => {
        return fetchRawls(root, _.merge(authOpts(), { signal, method: 'DELETE' }))
      },

      clone: async body => {
        const res = await fetchRawls(`${root}/clone`, _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]))
        return res.json()
      },

      shallowMergeNewAttributes: attributesObject => {
        const payload = attributesUpdateOps(attributesObject)
        return fetchRawls(root, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }]))
      },

      deleteAttributes: attributeNames => {
        const payload = _.map(attributeName => ({ op: 'RemoveAttribute', attributeName }), attributeNames)
        return fetchRawls(root, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }]))
      },

      entityMetadata: async () => {
        const res = await fetchRawls(`${root}/entities`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      snapshotEntityMetadata: (googleProject, dataReference) => {
        return getSnapshotEntityMetadata(getUser().token, namespace, name, googleProject, dataReference)
      },

      createEntity: async payload => {
        const res = await fetchRawls(`${root}/entities`, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }]))
        return res.json()
      },

      renameEntity: (type, name, newName) => {
        return fetchRawls(`${root}/entities/${type}/${name}/rename`, _.mergeAll([authOpts(), jsonBody({ name: newName }),
          { signal, method: 'POST' }]))
      },

      renameEntityType: (oldName, newName) => {
        const payload = { newName }

        return fetchRawls(`${root}/entityTypes/${oldName}`, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }]))
      },

      deleteEntitiesOfType: entityType => {
        return fetchRawls(`${root}/entityTypes/${entityType}`, _.merge(authOpts(), { signal, method: 'DELETE' }))
      },

      deleteEntityAttribute: (type, name, attributeName) => {
        return fetchRawls(`${root}/entities/${type}/${name}`, _.mergeAll([authOpts(), jsonBody([{ op: 'RemoveAttribute', attributeName }]),
          { signal, method: 'PATCH' }]))
      },

      deleteAttributeFromEntities: (entityType, attributeName, entityNames) => {
        const body = _.map(name => ({
          entityType, name, operations: [{ op: 'RemoveAttribute', attributeName }]
        }), entityNames)

        return fetchRawls(`${root}/entities/batchUpsert`, _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]))
      },

      deleteEntityColumn: (type, attributeName) => {
        return fetchRawls(`${root}/entities/${type}?attributeNames=${attributeName}`, _.mergeAll([authOpts(), { signal, method: 'DELETE' }]))
      },

      renameEntityColumn: (type, attributeName, newAttributeName) => {
        const payload = { newAttributeName }
        return fetchRawls(`${root}/entityTypes/${type}/attributes/${attributeName}`, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }]))
      },

      upsertEntities: entityUpdates => {
        return fetchRawls(`${root}/entities/batchUpsert`, _.mergeAll([authOpts(), jsonBody(entityUpdates), { signal, method: 'POST' }]))
      },

      paginatedEntitiesOfType: async (type, parameters) => {
        const res = await fetchRawls(`${root}/entityQuery/${type}?${qs.stringify(parameters)}`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      deleteEntities: entities => {
        return fetchRawls(`${root}/entities/delete`, _.mergeAll([authOpts(), jsonBody(entities), { signal, method: 'POST' }]))
      },

      getEntities: entityType => fetchRawls(`${root}/entities/${entityType}`, _.merge(authOpts(), { signal })).then(r => r.json()),

      getEntitiesTsv: entityType => fetchOrchestration(`api/workspaces/${namespace}/${name}/entities/${entityType}/tsv?model=flexible`, _.mergeAll([authOpts(), { signal }])).then(r => r.text()),

      copyEntities: async (destNamespace, destName, entityType, entities, link) => {
        const payload = {
          sourceWorkspace: { namespace, name },
          destinationWorkspace: { namespace: destNamespace, name: destName },
          entityType,
          entityNames: entities
        }
        const res = await fetchRawls(`workspaces/entities/copy?linkExistingEntities=${link}`, _.mergeAll([authOpts(), jsonBody(payload),
          { signal, method: 'POST' }]))
        return res.json()
      },

      importBagit: bagitURL => {
        return fetchOrchestration(
          `api/workspaces/${namespace}/${name}/importBagit`,
          _.mergeAll([authOpts(), jsonBody({ bagitURL, format: 'TSV' }), { signal, method: 'POST' }])
        )
      },

      importJSON: async url => {
        const res = await fetchOk(url)
        const payload = await res.json()

        const body = _.map(({ name, entityType, attributes }) => {
          return { name, entityType, operations: attributesUpdateOps(attributes) }
        }, payload)

        return fetchRawls(`${root}/entities/batchUpsert`, _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]))
      },

      importEntitiesFile: (file, { deleteEmptyValues = false } = {}) => {
        const formData = new FormData()
        formData.set('entities', file)
        return fetchOrchestration(`api/${root}/importEntities?${qs.stringify({ deleteEmptyValues })}`, _.merge(authOpts(), { body: formData, signal, method: 'POST' }))
      },

      importFlexibleEntitiesFileSynchronous: async (file, { deleteEmptyValues = false } = {}) => {
        const formData = new FormData()
        formData.set('entities', file)
        const res = await fetchOrchestration(`api/${root}/flexibleImportEntities?${qs.stringify({ deleteEmptyValues, async: false })}`, _.merge(authOpts(), { body: formData, signal, method: 'POST' }))
        return res
      },

      importFlexibleEntitiesFileAsync: async (file, { deleteEmptyValues = false } = {}) => {
        const formData = new FormData()
        formData.set('entities', file)
        const res = await fetchOrchestration(`api/${root}/flexibleImportEntities?${qs.stringify({ deleteEmptyValues, async: true })}`, _.merge(authOpts(), { body: formData, signal, method: 'POST' }))
        return res.json()
      },

      importJob: async (url, filetype, options) => {
        const res = await fetchOrchestration(`api/${root}/importJob`, _.mergeAll([authOpts(), jsonBody({ url, filetype, options }), { signal, method: 'POST' }]))
        return res.json()
      },

      getImportJobStatus: async jobId => {
        const res = await fetchOrchestration(`api/${root}/importJob/${jobId}`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      listImportJobs: async isRunning => {
        // ToDo: This endpoint should be deprecated in favor of more generic "importJob" endpoint
        const res = await fetchOrchestration(`api/${root}/importJob?running_only=${isRunning}`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      importSnapshot: async (snapshotId, name, description) => {
        const res = await fetchRawls(`${root}/snapshots/v2`, _.mergeAll([authOpts(), jsonBody({ snapshotId, name, description }), { signal, method: 'POST' }]))
        return res.json()
      },

      importAttributes: file => {
        const formData = new FormData()
        formData.set('attributes', file)
        return fetchOrchestration(`api/${root}/importAttributesTSV`, _.merge(authOpts(), { body: formData, signal, method: 'POST' }))
      },

      exportAttributes: async () => {
        const res = await fetchOrchestration(`api/${root}/exportAttributesTSV`, _.merge(authOpts(), { signal }))
        return res.blob()
      },

      storageCostEstimate: async () => {
        const res = await fetchOrchestration(`api/workspaces/${namespace}/${name}/storageCostEstimate`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      getTags: async () => {
        const res = await fetchOrchestration(`api/workspaces/${namespace}/${name}/tags`, _.merge(authOpts(), { signal, method: 'GET' }))
        return res.json()
      },

      addTag: async tag => {
        const res = await fetchOrchestration(`api/workspaces/${namespace}/${name}/tags`,
          _.mergeAll([authOpts(), jsonBody([tag]), { signal, method: 'PATCH' }]))
        return res.json()
      },

      deleteTag: async tag => {
        const res = await fetchOrchestration(`api/workspaces/${namespace}/${name}/tags`,
          _.mergeAll([authOpts(), jsonBody([tag]), { signal, method: 'DELETE' }]))
        return res.json()
      },

      accessInstructions: async () => {
        const res = await fetchRawls(`${root}/accessInstructions`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      bucketUsage: async () => {
        const res = await fetchRawls(`${root}/bucketUsage`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      listActiveFileTransfers: async () => {
        const res = await fetchRawls(`${root}/fileTransfers`, _.merge(authOpts(), { signal }))
        return res.json()
      }
    }
  }
})

const Catalog = signal => ({
  getDatasets: async () => {
    const res = await fetchCatalog('v1/datasets', _.merge(authOpts(), { signal }))
    return res.json()
  },
  getDatasetTables: async id => {
    const res = await fetchCatalog(`v1/datasets/${id}/tables`, _.merge(authOpts(), { signal }))
    return res.json()
  },
  getDatasetPreviewTable: async ({ id, tableName }) => {
    const res = await fetchCatalog(`v1/datasets/${id}/tables/${tableName}`, _.merge(authOpts(), { signal }))
    return res.json()
  },
  exportDataset: async ({ id, workspaceId }) => {
    return await fetchCatalog(`v1/datasets/${id}/export/${workspaceId}`, _.merge(authOpts(), { signal, method: 'POST' }))
  }
})

const DataRepo = signal => ({
  snapshot: snapshotId => {
    return {
      details: async () => {
        const res = await fetchDataRepo(`repository/v1/snapshots/${snapshotId}`, _.merge(authOpts(), { signal }))
        return res.json()
      },
      exportSnapshot: async () => {
        const res = await fetchDataRepo(`repository/v1/snapshots/${snapshotId}/export?validatePrimaryKeyUniqueness=false`, _.merge(authOpts(), { signal }))
        return res.json()
      }
    }
  },
  job: jobId => ({
    details: async () => {
      const res = await fetchDataRepo(`repository/v1/jobs/${jobId}`, _.merge(authOpts(), { signal }))
      return res.json()
    },
    result: async () => {
      const res = await fetchDataRepo(`repository/v1/jobs/${jobId}/result`, _.merge(authOpts(), { signal }))
      return res.json()
    }
  })
})

const FirecloudBucket = signal => ({
  getServiceAlerts: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/alerts.json`, { signal })
    return res.json()
  },

  getFeaturedWorkspaces: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/featured-workspaces.json`, { signal })
    return res.json()
  },

  getShowcaseWorkspaces: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/showcase.json`, { signal })
    return res.json()
  },

  getFeaturedMethods: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/featured-methods.json`, { signal })
    return res.json()
  },

  getTemplateWorkspaces: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/template-workspaces.json`, { signal })
    return res.json()
  }
})

const Methods = signal => ({
  list: async params => {
    const res = await fetchAgora(`methods?${qs.stringify(params)}`, _.merge(authOpts(), { signal }))
    return res.json()
  },

  definitions: async () => {
    const res = await fetchAgora('methods/definitions', _.merge(authOpts(), { signal }))
    return res.json()
  },

  configInputsOutputs: async loadedConfig => {
    const res = await fetchRawls('methodconfigs/inputsOutputs',
      _.mergeAll([authOpts(), jsonBody(loadedConfig.methodRepoMethod), { signal, method: 'POST' }]))
    return res.json()
  },

  template: async modifiedConfigMethod => {
    const res = await fetchRawls('methodconfigs/template',
      _.mergeAll([authOpts(), jsonBody(modifiedConfigMethod), { signal, method: 'POST' }]))
    return res.json()
  },

  method: (namespace, name, snapshotId) => {
    const root = `methods/${namespace}/${name}/${snapshotId}`

    return {
      get: async () => {
        const res = await fetchAgora(root, _.merge(authOpts(), { signal }))
        return res.json()
      },

      configs: async () => {
        const res = await fetchAgora(`${root}/configurations`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      allConfigs: async () => {
        const res = await fetchAgora(`methods/${namespace}/${name}/configurations`, _.merge(authOpts(), { signal }))
        return res.json()
      },

      toWorkspace: async (workspace, config = {}) => {
        const res = await fetchRawls(`workspaces/${workspace.namespace}/${workspace.name}/methodconfigs`,
          _.mergeAll([authOpts(), jsonBody(_.merge({
            methodRepoMethod: {
              methodUri: `agora://${namespace}/${name}/${snapshotId}`
            },
            name,
            namespace,
            rootEntityType: '',
            prerequisites: {},
            inputs: {},
            outputs: {},
            methodConfigVersion: 1,
            deleted: false
          },
          config.payloadObject
          )), { signal, method: 'POST' }]))
        return res.json()
      }
    }
  }
})

const Submissions = signal => ({
  queueStatus: async () => {
    const res = await fetchRawls('submissions/queueStatus', _.merge(authOpts(), { signal }))
    return res.json()
  },

  cromwellVersion: async () => {
    const res = await fetchOk(`${getConfig().rawlsUrlRoot}/version/executionEngine`, { signal })
    return res.json()
  }
})

const Dockstore = signal => ({
  getWdl: async ({ path, version, isTool }) => {
    const res = await fetchDockstore(`${dockstoreMethodPath({ path, isTool })}/${encodeURIComponent(version)}/WDL/descriptor`, { signal })
    const { url } = await res.json()
    return fetchOk(url, { signal }).then(res => res.text())
  },

  getVersions: async ({ path, isTool }) => {
    const res = await fetchDockstore(dockstoreMethodPath({ path, isTool }), { signal })
    return res.json()
  },

  listTools: (params = {}) => fetchDockstore(`api/ga4gh/v1/tools?${qs.stringify(params)}`).then(r => r.json())
})

const shouldUseDrsHub = !!getConfig().shouldUseDrsHub

const DrsUriResolver = signal => ({
  //Currently only Martha and not DRSHub can get a signed URL
  getSignedUrl: async ({ bucket, object, dataObjectUri }) => {
    const res = await fetchMartha(
      'getSignedUrlV1',
      _.mergeAll([jsonBody({ bucket, object, dataObjectUri }), authOpts(), appIdentifier, { signal, method: 'POST' }]))
    return res.json()
  },

  getDataObjectMetadata: async (url, fields) => {
    if (shouldUseDrsHub) {
      const res = await fetchDrsHub(
        '/api/v4/drs/resolve',
        _.mergeAll([jsonBody({ url, fields }), authOpts(), appIdentifier, { signal, method: 'POST' }])
      )
      return res.json()
    } else {
      const res = await fetchMartha(
        'martha_v3',
        _.mergeAll([jsonBody({ url, fields }), authOpts(), appIdentifier, { signal, method: 'POST' }])
      )
      return res.json()
    }
  }
})

const Duos = signal => ({
  getConsent: async orspId => {
    const res = await fetchOrchestration(`/api/duos/consent/orsp/${orspId}`, _.merge(authOpts(), { signal }))
    return res.json()
  }
})

const OAuth2 = signal => ({
  getConfiguration: async () => {
    const res = await fetchOrchestration('/oauth2/configuration', _.merge(authOpts(), { signal }))
    return res.json()
  }
})

const Surveys = signal => ({
  submitForm: withErrorIgnoring((formId, data) => {
    return fetchGoogleForms(`${formId}/formResponse?${qs.stringify(data)}`, { signal })
  })
})

export const Ajax = signal => {
  return {
    User: User(signal),
    Groups: Groups(signal),
    Resources: Resources(),
    Billing: Billing(signal),
    Workspaces: Workspaces(signal),
    Catalog: Catalog(signal),
    DataRepo: DataRepo(signal),
    AzureStorage: AzureStorage(signal),
    Buckets: GoogleStorage(signal),
    Methods: Methods(signal),
    Submissions: Submissions(signal),
    Runtimes: Runtimes(signal),
    Apps: Apps(signal),
    Dockstore: Dockstore(signal),
    DrsUriResolver: DrsUriResolver(signal),
    Duos: Duos(signal),
    Metrics: Metrics(signal),
    Disks: Disks(signal),
    CromIAM: CromIAM(signal),
    FirecloudBucket: FirecloudBucket(signal),
    OAuth2: OAuth2(signal),
    Surveys: Surveys(signal)
  }
}

// Exposing Ajax for use by integration tests (and debugging, or whatever)
window.Ajax = Ajax
