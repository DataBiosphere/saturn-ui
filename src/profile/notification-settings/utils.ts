import { refreshSamUserAttributes, refreshTerraProfile } from 'src/auth/user-profile/user';
import { Metrics } from 'src/libs/ajax/Metrics';
import { User } from 'src/libs/ajax/User';
import Events, { EventWorkspaceAttributes, extractWorkspaceDetails } from 'src/libs/events';

export const workspaceSubmissionNotificationKeys = (namespace: string, name: string) => [
  `notifications/SuccessfulSubmissionNotification/${namespace}/${name}`,
  `notifications/FailedSubmissionNotification/${namespace}/${name}`,
  `notifications/AbortedSubmissionNotification/${namespace}/${name}`,
];

export const workspaceChangedNotificationKey = (namespace: string, name: string) => [
  `notifications/WorkspaceChangedNotification/${namespace}/${name}`,
];

export const workspaceSubmissionNotificationInfo =
  'Receive email notifications when a submission in this workspace has succeeded, failed, or been aborted.';
export const workspaceChangedNotificationInfo =
  'Receive email notifications when an owner of a workspace sends a data changed notification.';

export type NotificationType =
  | 'WorkspaceSubmission'
  | 'WorkspaceChanged'
  | 'GroupAccessRequest'
  | 'WorkspaceAccessAdded'
  | 'WorkspaceAccessRemoved'
  | 'PlatformOperations'
  | 'Marketing';

const notificationKeysWithValue = (notificationKeys: string[], value: boolean): Record<string, string> => {
  return Object.fromEntries(notificationKeys.map((notificationKey) => [notificationKey, JSON.stringify(value)]));
};

export const notificationEnabled = (notificationKeys: string[], prefsData: Record<string, string>): boolean => {
  // Thurloe defaults all notifications to being on. So if the key is not present, then we also treat that as enabled
  const allNotificationsDisabled = notificationKeysWithValue(notificationKeys, false);
  return !Object.entries(allNotificationsDisabled).every(([key, value]) => prefsData[key] === value);
};

export const updateNotificationPreferences = async (
  notificationKeys: string[],
  value: boolean,
  notificationType: NotificationType | undefined,
  workspace: EventWorkspaceAttributes | undefined
) => {
  await User().profile.setPreferences(notificationKeysWithValue(notificationKeys, value));
  await refreshTerraProfile();
  let eventDetails = { notificationKeys, enabled: value, notificationType };
  if (workspace) {
    eventDetails = { ...eventDetails, ...extractWorkspaceDetails(workspace) };
  }
  void Metrics().captureEvent(Events.notificationToggle, eventDetails);
};

export const updateUserAttributes = async (
  notificationKeys: string[],
  value: boolean,
  notificationType: NotificationType | undefined
) => {
  await User().setUserAttributes({ marketingConsent: value });
  void Metrics().captureEvent(Events.notificationToggle, { notificationKeys, enabled: value, notificationType });
  await refreshSamUserAttributes();
};
