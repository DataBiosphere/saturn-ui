import _ from 'lodash/fp'
import * as qs from 'qs'
import { version } from 'src/data/machines'
import { appIdentifier, authOpts, fetchLeo, fetchOk, jsonBody } from 'src/libs/ajax/ajax-common'
import { getConfig } from 'src/libs/config'


export const Runtimes = signal => ({
  list: async (labels = {}) => {
    const res = await fetchLeo(`api/google/v1/runtimes?${qs.stringify({ saturnAutoCreated: true, ...labels })}`,
      _.mergeAll([authOpts(), appIdentifier, { signal }]))
    return res.json()
  },

  invalidateCookie: () => {
    return fetchLeo('proxy/invalidateToken', _.merge(authOpts(), { signal }))
  },

  setCookie: () => {
    return fetchLeo('proxy/setCookie', _.merge(authOpts(), { signal, credentials: 'include' }))
  },

  runtime: (project, name) => {
    const root = `api/google/v1/runtimes/${project}/${name}`

    return {
      details: async () => {
        const res = await fetchLeo(root, _.mergeAll([authOpts(), { signal }, appIdentifier]))
        return res.json()
      },
      create: options => {
        const body = _.merge(options, {
          labels: { saturnAutoCreated: 'true', saturnVersion: version },
          defaultClientId: getConfig().googleClientId,
          userJupyterExtensionConfig: {
            nbExtensions: {
              'saturn-iframe-extension':
                `${window.location.hostname === 'localhost' ? getConfig().devUrlRoot : window.location.origin}/jupyter-iframe-extension.js`
            },
            labExtensions: {},
            serverExtensions: {},
            combinedExtensions: {}
          },
          scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'],
          enableWelder: true
        })
        return fetchLeo(root, _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }, appIdentifier]))
      },

      update: options => {
        const body = { ...options, allowStop: true }
        return fetchLeo(root, _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'PATCH' }, appIdentifier]))
      },

      start: () => {
        return fetchLeo(`${root}/start`, _.mergeAll([authOpts(), { signal, method: 'POST' }, appIdentifier]))
      },

      stop: () => {
        return fetchLeo(`${root}/stop`, _.mergeAll([authOpts(), { signal, method: 'POST' }, appIdentifier]))
      },

      delete: deleteDisk => {
        return fetchLeo(`${root}${qs.stringify({ deleteDisk }, { addQueryPrefix: true })}`,
          _.mergeAll([authOpts(), { signal, method: 'DELETE' }, appIdentifier]))
      }
    }
  },

  azureProxy: proxyUrl => {
    return {
      setAzureCookie: () => {
        return fetchOk(`${proxyUrl}/setCookie`, _.merge(authOpts(), { signal, credentials: 'include' }))
      },

      setStorageLinks: (localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, pattern) => {
        return fetchOk(`${proxyUrl}/welder/storageLinks`,
          _.mergeAll([authOpts(), jsonBody({
            localBaseDirectory,
            localSafeModeBaseDirectory,
            cloudStorageDirectory,
            pattern
          }), { signal, method: 'POST' }]))
      }
    }
  },

  listV2: async (labels = {}) => {
    const res = await fetchLeo(`api/v2/runtimes?${qs.stringify({ saturnAutoCreated: true, ...labels })}`,
      _.mergeAll([authOpts(), appIdentifier, { signal }]))
    return res.json()
  },

  listV2WithWorkspace: async (workspaceId, labels = {}) => {
    const res = await fetchLeo(`api/v2/runtimes/${workspaceId}?${qs.stringify({ saturnAutoCreated: true, ...labels })}`,
      _.mergeAll([authOpts(), appIdentifier, { signal }]))
    return res.json()
  },

  runtimeV2: (workspaceId, name, cloudProvider = 'azure') => {
    const root = `api/v2/runtimes/${workspaceId}/${cloudProvider}/${name}`

    return {

      details: async () => {
        const res = await fetchLeo(root, _.mergeAll([authOpts(), { signal }, appIdentifier]))
        return res.json()
      },

      create: options => {
        const body = _.merge(options, {
          labels: { saturnAutoCreated: 'true', saturnVersion: version }
        })
        return fetchLeo(root, _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }, appIdentifier]))
      },

      delete: (deleteDisk = true) => {
        return fetchLeo(`${root}${qs.stringify({ deleteDisk }, { addQueryPrefix: true })}`,
          _.mergeAll([authOpts(), { signal, method: 'DELETE' }, appIdentifier]))
      }
    }
  },

  fileSyncing: (project, name) => {
    const root = `proxy/${project}/${name}`

    return {
      oldLocalize: files => {
        return fetchLeo(`notebooks/${project}/${name}/api/localize`, // this is the old root url
          _.mergeAll([authOpts(), jsonBody(files), { signal, method: 'POST' }]))
      },

      localize: entries => {
        const body = { action: 'localize', entries }
        return fetchLeo(`${root}/welder/objects`,
          _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]))
      },

      setStorageLinks: (localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, pattern) => {
        return fetchLeo(`${root}/welder/storageLinks`,
          _.mergeAll([authOpts(), jsonBody({
            localBaseDirectory,
            localSafeModeBaseDirectory,
            cloudStorageDirectory,
            pattern
          }), { signal, method: 'POST' }]))
      },

      lock: async localPath => {
        try {
          await fetchLeo(`${root}/welder/objects/lock`, _.mergeAll([authOpts(), jsonBody({ localPath }), { signal, method: 'POST' }]))
          return true
        } catch (error) {
          if (error.status === 409) {
            return false
          } else {
            throw error
          }
        }
      }
    }
  }
})
