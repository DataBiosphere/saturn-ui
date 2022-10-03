import { getDefaultProperties } from '@databiosphere/bard-client'
import _ from 'lodash/fp'
import { authOpts, fetchBard, jsonBody } from 'src/libs/ajax/ajax-common'
import { ensureAuthSettled } from 'src/libs/auth'
import { withErrorIgnoring } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import { authStore, userStatus } from 'src/libs/state'
import { v4 as uuid } from 'uuid'


export const Metrics = signal => ({
  captureEvent: withErrorIgnoring(async (event, details = {}) => {
    await ensureAuthSettled()
    const { isSignedIn, registrationStatus } = authStore.get() // NOTE: This is intentionally read after ensureAuthSettled
    const isRegistered = isSignedIn && registrationStatus === userStatus.registeredWithTos
    if (!isRegistered) {
      authStore.update(_.update('anonymousId', id => {
        return id || uuid()
      }))
    }
    const body = {
      event,
      properties: {
        ...details,
        distinct_id: isRegistered ? undefined : authStore.get().anonymousId,
        appId: 'Saturn',
        hostname: window.location.hostname,
        appPath: Nav.getCurrentRoute().name,
        ...getDefaultProperties()
      }
    }

    return fetchBard('api/event', _.mergeAll([isRegistered ? authOpts() : undefined, jsonBody(body), { signal, method: 'POST' }]))
  }),

  syncProfile: withErrorIgnoring(() => {
    return fetchBard('api/syncProfile', _.merge(authOpts(), { signal, method: 'POST' }))
  }),

  identify: withErrorIgnoring(anonId => {
    const body = { anonId }
    return fetchBard('api/identify', _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]))
  })
})
