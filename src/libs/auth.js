import { addDays, differenceInDays, parseJSON } from 'date-fns/fp'
import _ from 'lodash/fp'
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { FrameworkServiceLink, ShibbolethLink, UnlinkFenceAccount } from 'src/components/common'
import { cookiesAcceptedKey } from 'src/components/CookieWarning'
import { Ajax, fetchOk } from 'src/libs/ajax'
import { getEnabledBrand } from 'src/libs/brand-utils'
import { getConfig } from 'src/libs/config'
import { withErrorIgnoring, withErrorReporting } from 'src/libs/error'
import { captureAppcuesEvent } from 'src/libs/events'
import * as Nav from 'src/libs/nav'
import { clearMatchingNotifications, clearNotification, notify, sessionTimeoutProps } from 'src/libs/notifications'
import { getLocalPref, getLocalPrefForUserId, setLocalPref } from 'src/libs/prefs'
import allProviders from 'src/libs/providers'
import {
  asyncImportJobStore, authStore, azureCookieReadyStore, cookieReadyStore, requesterPaysProjectStore, userStatus, workspacesStore, workspaceStore
} from 'src/libs/state'
import * as Utils from 'src/libs/utils'


export const getOidcConfig = () => {
  const metadata = {
    authorization_endpoint: `${getConfig().orchestrationUrlRoot}/oauth2/authorize`,
    token_endpoint: `${getConfig().orchestrationUrlRoot}/oauth2/token`,
    ...(isGoogleAuthority() && {
      userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      revocation_endpoint: 'https://oauth2.googleapis.com/revoke'
    })
  }
  return {
    authority: `${getConfig().orchestrationUrlRoot}/oauth2/authorize`,
    client_id: authStore.get().oidcConfig.clientId,
    popup_redirect_uri: `${window.origin}/redirect-from-oauth`,
    silent_redirect_uri: `${window.origin}/redirect-from-oauth-silent`,
    metadata,
    prompt: 'consent login',
    scope: 'openid email profile',
    loadUserInfo: isGoogleAuthority(),
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
    includeIdTokenInSilentRenew: true,
    extraQueryParams: { access_type: 'offline' }
  }
}

const isGoogleAuthority = () => {
  return _.startsWith('https://accounts.google.com', authStore.get().oidcConfig.authorityEndpoint)
}

const getAuthInstance = () => {
  return authStore.get().authContext
}

export const signOut = () => {
  // TODO: invalidate runtime cookies https://broadworkbench.atlassian.net/browse/IA-3498
  cookieReadyStore.reset()
  azureCookieReadyStore.reset()
  sessionStorage.clear()
  const auth = getAuthInstance()
  revokeTokens()
    .finally(() => auth.removeUser())
    .finally(() => auth.clearStaleState())
}

const revokeTokens = async () => {
  const auth = getAuthInstance()
  if (auth.settings.metadata.revocation_endpoint) {
    // revokeTokens can fail if the the token has already been revoked.
    // Recover from invalid_token errors to make sure signOut completes successfully.
    try {
      await auth.revokeTokens()
    } catch (e) {
      if (e.error === 'invalid_token') {
        return null
      } else {
        throw e
      }
    }
  }
}

const getSigninArgs = includeBillingScope => {
  return Utils.cond(
    [includeBillingScope === false, () => ({})],
    // For Google just append the scope to the signin args.
    [isGoogleAuthority(), () => ({ scope: 'openid email profile https://www.googleapis.com/auth/cloud-billing' })],
    // For B2C switch to a dedicated policy endpoint configured for the GCP cloud-billing scope.
    () => ({
      extraQueryParams: { access_type: 'offline', p: getConfig().b2cBillingPolicy },
      extraTokenParams: { p: getConfig().b2cBillingPolicy }
    })
  )
}

export const signIn = async (includeBillingScope = false) => {
  const args = getSigninArgs(includeBillingScope)
  const user = await getAuthInstance().signinPopup(args)

  // For B2C record in the auth store whether we requested the GCP cloud-billing scope since there
  // is no way to determine it after the fact.
  // For Google we don't need to do this since we can inspect the scope directly in the user object.
  if (!isGoogleAuthority()) {
    authStore.update(state => ({ ...state, hasGcpBillingScopeThroughB2C: includeBillingScope }))
  }

  return user
}

export const reloadAuthToken = (includeBillingScope = false) => {
  const args = getSigninArgs(includeBillingScope)
  return getAuthInstance().signinSilent(args).catch(() => false)
}

export const hasBillingScope = () => {
  return Utils.cond(
    // For Google check the scope directly on the user object.
    [isGoogleAuthority(), () => _.includes('https://www.googleapis.com/auth/cloud-billing', getUser().scope)],
    // For B2C check the hasGcpBillingScopeThroughB2C field in the auth store.
    () => authStore.get().hasGcpBillingScopeThroughB2C === true
  )
}

/*
 * Tries to obtain Google Cloud Billing scope silently.

 * This will succeed if the user previously granted the scope for the application, and fail otherwise.
 * Call `ensureBillingScope` to generate a pop-up to prompt the user to grant the scope if needed.
 */
export const tryBillingScope = async () => {
  if (!hasBillingScope()) {
    await reloadAuthToken(true)
  }
}

/*
 * Request Google Cloud Billing scope if necessary.
 *
 * NOTE: Requesting additional scopes may invoke a browser pop-up which the browser might block.
 * If you use ensureBillingScope during page load and the pop-up is blocked, a rejected promise will
 * be returned. In this case, you'll need to provide something for the user to deliberately click on
 * and retry ensureBillingScope in reaction to the click.
 */
export const ensureBillingScope = async () => {
  if (!hasBillingScope()) {
    await signIn(true)
  }
}

const becameRegistered = (oldState, state) => {
  return (oldState.registrationStatus !== userStatus.registeredWithTos && state.registrationStatus === userStatus.registeredWithTos)
}

export const isAuthSettled = ({ isSignedIn, registrationStatus }) => {
  return isSignedIn !== undefined && (!isSignedIn || registrationStatus !== undefined)
}

export const ensureAuthSettled = () => {
  if (isAuthSettled(authStore.get())) {
    return
  }
  return new Promise(resolve => {
    const subscription = authStore.subscribe(state => {
      if (isAuthSettled(state)) {
        resolve()
        subscription.unsubscribe()
      }
    })
  })
}

export const getUser = () => {
  return authStore.get().user
}

export const bucketBrowserUrl = id => {
  return `https://console.cloud.google.com/storage/browser/${id}?authuser=${getUser().email}`
}

export const processUser = (user, isSignInEvent) => {
  return authStore.update(state => {
    const isSignedIn = !_.isNil(user)
    const profile = user?.profile
    const userId = profile?.sub

    // The following few lines of code are to handle sign-in failures due to privacy tools.
    if (isSignInEvent === true && state.isSignedIn === false && isSignedIn === false) {
      //if both of these values are false, it means that the user was initially not signed in (state.isSignedIn === false),
      //tried to sign in (invoking processUser) and was still not signed in (isSignedIn === false).
      notify('error', 'Could not sign in', {
        message: 'Click for more information',
        detail: 'If you are using privacy blockers, they may be preventing you from signing in. Please disable those tools, refresh, and try signing in again.',
        timeout: 30000
      })
    }
    return {
      ...state,
      isSignedIn,
      anonymousId: !isSignedIn && state.isSignedIn ? undefined : state.anonymousId,
      registrationStatus: isSignedIn ? state.registrationStatus : undefined,
      acceptedTos: isSignedIn ? state.acceptedTos : undefined,
      profile: isSignedIn ? state.profile : {},
      nihStatus: isSignedIn ? state.nihStatus : undefined,
      fenceStatus: isSignedIn ? state.fenceStatus : {},
      // Load whether a user has input a cookie acceptance in a previous session on this system,
      // or whether they input cookie acceptance previously in this session
      cookiesAccepted: isSignedIn ? state.cookiesAccepted || getLocalPrefForUserId(userId, cookiesAcceptedKey) : undefined,
      isTimeoutEnabled: isSignedIn ? state.isTimeoutEnabled : undefined,
      hasGcpBillingScopeThroughB2C: isSignedIn ? state.hasGcpBillingScopeThroughB2C : undefined,
      user: {
        token: user?.access_token,
        scope: user?.scope,
        id: userId,
        ...(profile ? {
          email: profile.email,
          name: profile.name,
          givenName: profile.givenName,
          familyName: profile.familyName,
          imageUrl: profile.picture
        } : {})
      }
    }
  })
}

export const initializeAuth = _.memoize(async () => {
  // Instiante a UserManager directly to populate the logged-in user at app initialization time.
  // All other auth usage should use the AuthContext from authStore.
  const userManager = new UserManager(getOidcConfig())
  processUser(await userManager.getUser())
})

export const initializeClientId = _.memoize(async () => {
  const oidcConfig = await Ajax().OAuth2.getConfiguration()
  authStore.update(state => ({ ...state, oidcConfig }))
})

// This is intended for tests to short circuit the login flow
window.forceSignIn = withErrorReporting('Error forcing sign in', async token => {
  await initializeAuth() // don't want this clobbered when real auth initializes
  const res = await fetchOk(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  authStore.update(state => {
    return {
      ...state,
      isSignedIn: true,
      registrationStatus: undefined,
      isTimeoutEnabled: undefined,
      cookiesAccepted: true,
      profile: {},
      user: {
        token,
        id: data.sub,
        email: data.email,
        name: data.name,
        givenName: data.given_name,
        familyName: data.family_name,
        imageUrl: data.picture
      }
    }
  })
})

authStore.subscribe(withErrorReporting('Error checking registration', async (state, oldState) => {
  const getRegistrationStatus = async () => {
    try {
      const { enabled } = await Ajax().User.getStatus()
      if (enabled) {
        // While initial state is first loading, state.acceptedTos will be undefined (it will then be `true` on the
        // second execution of this code, which is still part of the initial rendering).
        return state.acceptedTos ? userStatus.registeredWithTos : userStatus.registeredWithoutTos
      } else {
        return userStatus.disabled
      }
    } catch (error) {
      if (error.status === 404) {
        return userStatus.unregistered
      } else {
        throw error
      }
    }
  }
  if ((!oldState.isSignedIn && state.isSignedIn) || (!oldState.acceptedTos && state.acceptedTos)) {
    clearNotification(sessionTimeoutProps.id)
    const registrationStatus = await getRegistrationStatus()
    authStore.update(state => ({ ...state, registrationStatus }))
  }
}))

authStore.subscribe(withErrorReporting('Error checking TOS', async (state, oldState) => {
  if (!oldState.isSignedIn && state.isSignedIn) {
    const acceptedTos = await Ajax().User.getTosAccepted()
    authStore.update(state => ({ ...state, acceptedTos }))
  }
}))

authStore.subscribe(withErrorIgnoring(async (state, oldState) => {
  if (!oldState.acceptedTos && state.acceptedTos) {
    if (window.Appcues) {
      window.Appcues.identify(state.user.id, {
        dateJoined: parseJSON((await Ajax().User.firstTimestamp()).timestamp).getTime()
      })
      window.Appcues.on('all', captureAppcuesEvent)
    }
  }
}))

authStore.subscribe(state => {
  // We can't guarantee that someone reopening the window is the same user,
  // so we should not persist cookie acceptance across sessions for people signed out
  // Per compliance recommendation, we could probably persist through a session, but
  // that would require a second store in session storage instead of local storage
  if (state.isSignedIn && state.cookiesAccepted !== getLocalPref(cookiesAcceptedKey)) {
    setLocalPref(cookiesAcceptedKey, state.cookiesAccepted)
  }
})

authStore.subscribe(withErrorReporting('Error checking groups for timeout status', async (state, oldState) => {
  if (becameRegistered(oldState, state)) {
    const isTimeoutEnabled = _.some({ groupName: 'session_timeout' }, await Ajax().Groups.list())
    authStore.update(state => ({ ...state, isTimeoutEnabled }))
  }
}))

export const refreshTerraProfile = async () => {
  const profile = Utils.kvArrayToObject((await Ajax().User.profile.get()).keyValuePairs)
  authStore.update(state => ({ ...state, profile }))
}

authStore.subscribe(withErrorReporting('Error loading user profile', async (state, oldState) => {
  if (!oldState.isSignedIn && state.isSignedIn) {
    await refreshTerraProfile()
  }
}))

authStore.subscribe(withErrorReporting('Error loading NIH account link status', async (state, oldState) => {
  if (becameRegistered(oldState, state)) {
    const nihStatus = await Ajax().User.getNihStatus()
    authStore.update(state => ({ ...state, nihStatus }))
  }
}))

authStore.subscribe(withErrorIgnoring(async (state, oldState) => {
  if (becameRegistered(oldState, state)) {
    await Ajax().Metrics.syncProfile()
  }
}))

authStore.subscribe(withErrorIgnoring(async (state, oldState) => {
  if (becameRegistered(oldState, state)) {
    if (state.anonymousId) {
      return await Ajax().Metrics.identify(state.anonymousId)
    }
  }
}))

authStore.subscribe((state, oldState) => {
  if (state.nihStatus !== oldState.nihStatus) {
    const now = Date.now()
    const expireTime = state.nihStatus && state.nihStatus.linkExpireTime * 1000
    const shouldNotify = expireTime && now > expireTime - (1000 * 60 * 60 * 24)
    if (shouldNotify) {
      const hasExpired = now >= expireTime

      // There are separate notification IDs for expired and expires soon so that mute preferences can be stored
      // individually for each. If a user mutes the expires soon notification, we still want to show them the expired
      // notification.
      const notificationId = hasExpired ? 'nih-link-expired' : 'nih-link-expires-soon'

      // If/when the notification is muted, the expiration time of the current NIH link is stored in local preferences.
      // This lets us apply the mute preference only to the current NIH link. If the user re-links their NIH account
      // after muting notifications, we want to show these notifications when the new link will expire. In that case,
      // the new link will have an expiration time greater than the time stored in the mute preference.
      const muteNotificationPreferenceKey = `mute-nih-notification/${notificationId}`
      const muteNotificationUntil = getLocalPref(muteNotificationPreferenceKey)
      if (muteNotificationUntil && muteNotificationUntil >= expireTime) {
        return
      }

      notify('info', `Your access to NIH Controlled Access workspaces and data ${hasExpired ? 'has expired' : 'will expire soon'}.`, {
        id: notificationId,
        message: h(Fragment, [
          'To regain access, ',
          h(ShibbolethLink, { style: { color: 'unset', fontWeight: 600, textDecoration: 'underline' } }, ['re-link']),
          ` your eRA Commons / NIH account (${state.nihStatus.linkedNihUsername}) with ${getEnabledBrand().name}.`
        ]),
        action: {
          label: 'Do not remind me again',
          callback: () => {
            setLocalPref(muteNotificationPreferenceKey, expireTime)
          }
        }
      })
    } else {
      clearNotification('nih-link-expired')
      clearNotification('nih-link-expires-soon')
    }
  }
})

authStore.subscribe(withErrorReporting('Error loading Framework Services account status', async (state, oldState) => {
  if (becameRegistered(oldState, state)) {
    await Promise.all(_.map(async ({ key }) => {
      const status = await Ajax().User.getFenceStatus(key)
      authStore.update(_.set(['fenceStatus', key], status))
    }, allProviders))
  }
}))

export const updateFenceLinkExpirationNotification = (provider, status) => {
  const { key, name } = provider

  // Clear any old notifications
  clearMatchingNotifications(`fence-link-expiration/${key}/`)

  const now = Date.now()
  // Bond API returns link time as an ISO formatted string.
  const dateOfExpiration = status && addDays(provider.expiresAfter, parseJSON(status.issued_at))
  const shouldNotify = Boolean(dateOfExpiration) && now >= addDays(-5, dateOfExpiration)

  if (shouldNotify) {
    const hasExpired = now >= dateOfExpiration

    // Separate notifications for expired and expiring. If a user mutes the notification that a link will
    // expire soon, then we still want to notify them once the link has actually expired.
    // The link expiration time is included in the notification ID so that a muting notifications only
    // applies to the current instance of the link. If an account is re-linked, notifications should
    // be shown again when that link is expiring.
    const notificationId = `fence-link-expiration/${key}/${dateOfExpiration.getTime()}/${hasExpired ? 'expired' : 'expiring'}`

    const expireStatus = hasExpired ?
      'has expired' :
      `will expire in ${differenceInDays(now, dateOfExpiration)} day(s)`

    const redirectUrl = `${window.location.origin}/${Nav.getLink('fence-callback')}`
    notify('info', div([
      `Your access to ${name} ${expireStatus}. Log in to `,
      h(FrameworkServiceLink, { linkText: expireStatus === 'has expired' ? 'restore ' : 'renew ', provider: key, redirectUrl }),
      ' your access or ',
      h(UnlinkFenceAccount, { linkText: 'unlink ', provider: { key, name } }),
      ' your account.'
    ]), {
      id: notificationId,
      action: {
        label: 'Do not remind me again',
        callback: () => {
          muteNotification(notificationId)
        }
      }
    })
  }
}

authStore.subscribe((state, oldState) => {
  _.forEach(provider => {
    const { key } = provider
    const status = state.fenceStatus[key]
    const oldStatus = oldState.fenceStatus[key]
    if (status !== oldStatus) {
      updateFenceLinkExpirationNotification(provider, status)
    }
  }, allProviders)
})

authStore.subscribe((state, oldState) => {
  if (oldState.isSignedIn && !state.isSignedIn) {
    workspaceStore.reset()
    workspacesStore.reset()
    asyncImportJobStore.reset()
    window.Appcues?.reset()
  }
})

workspaceStore.subscribe((newState, oldState) => {
  const getWorkspaceId = ws => ws?.workspace.workspaceId
  if (getWorkspaceId(newState) !== getWorkspaceId(oldState)) {
    requesterPaysProjectStore.reset()
  }
})
