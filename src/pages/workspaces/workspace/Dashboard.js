import _ from 'lodash/fp';
import { Fragment, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { dd, div, dl, dt, h, h3, i, span } from 'react-hyperscript-helpers';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { requesterPaysWrapper } from 'src/components/bucket-utils';
import { ClipboardButton } from 'src/components/ClipboardButton';
import Collapse from 'src/components/Collapse';
import { ButtonPrimary, ButtonSecondary, LabeledCheckbox, Link, spinnerOverlay } from 'src/components/common';
import { centeredSpinner, icon, spinner } from 'src/components/icons';
import { MarkdownEditor, MarkdownViewer } from 'src/components/markdown';
import { InfoBox } from 'src/components/PopupTrigger';
import { getRegionInfo } from 'src/components/region-common';
import RequesterPaysModal from 'src/components/RequesterPaysModal';
import { SimpleTable, TooltipCell } from 'src/components/table';
import TooltipTrigger from 'src/components/TooltipTrigger';
import { WorkspaceTagSelect } from 'src/components/workspace-utils';
import { ReactComponent as AzureLogo } from 'src/images/azure.svg';
import { ReactComponent as GcpLogo } from 'src/images/gcp.svg';
import { Ajax } from 'src/libs/ajax';
import { bucketBrowserUrl, refreshTerraProfile } from 'src/libs/auth';
import { getRegionFlag, getRegionLabel } from 'src/libs/azure-utils';
import { getEnabledBrand } from 'src/libs/brand-utils';
import colors from 'src/libs/colors';
import { reportError, withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import { forwardRefWithName, useCancellation, useOnMount, useStore } from 'src/libs/react-utils';
import { authStore, requesterPaysProjectStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import {
  canEditWorkspace,
  canWrite,
  hasProtectedData,
  hasRegionConstraint,
  isAzureWorkspace,
  isGoogleWorkspace,
  isOwner,
  protectedDataMessage,
  regionConstraintMessage,
} from 'src/libs/workspace-utils';
import SignIn from 'src/pages/SignIn';
import DashboardPublic from 'src/pages/workspaces/workspace/DashboardPublic';
import { displayConsentCodes, displayLibraryAttributes } from 'src/pages/workspaces/workspace/library-attributes';
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer';

const styles = {
  authDomain: {
    padding: '0.5rem 0.25rem',
    marginBottom: '0.25rem',
    backgroundColor: colors.dark(0.15),
    ...Style.noWrapEllipsis,
  },
  tag: {
    padding: '0.25rem',
    margin: '0.15rem',
    backgroundColor: colors.dark(0.15),
    borderRadius: 10,
    overflow: 'hidden',
    wordWrap: 'break-word',
  },
};

const roleString = {
  READER: 'Reader',
  WRITER: 'Writer',
  OWNER: 'Owner',
  PROJECT_OWNER: 'Project Owner',
};

const InfoRow = ({ title, subtitle, children }) => {
  return div({ style: { display: 'flex', justifyContent: 'space-between', margin: '1rem 0.5rem' } }, [
    dt({ style: { width: 225 } }, [
      div({ style: { fontWeight: 500 } }, [title]),
      subtitle && div({ style: { fontWeight: 400, fontSize: 12 } }, [subtitle]),
    ]),
    dd({ style: { width: 225, display: 'flex', overflow: 'hidden' } }, [children]),
  ]);
};

const displayAttributeValue = (v) => {
  return Utils.cond(
    [_.isArray(v), () => v.join(', ')],
    [v?.items, () => v.items.join(', ')],
    [v === true, () => 'Yes'],
    [v === false, () => 'No'],
    () => v
  );
};

const DataUseLimitations = ({ attributes }) => {
  return _.map(
    ({ key, title }) => {
      return div({ key, style: { display: 'inline-block', marginRight: '0.75rem' } }, [
        h(TooltipTrigger, { content: title }, [span({ style: { textDecoration: 'underline dotted' } }, [key.slice(8)])]),
        ': ',
        displayAttributeValue(attributes[key]),
      ]);
    },
    _.filter(({ key }) => _.has(key, attributes), displayConsentCodes)
  );
};

const DashboardAuthContainer = (props) => {
  const { namespace, name } = props;
  const { signInStatus } = useStore(authStore);
  const [featuredWorkspaces, setFeaturedWorkspaces] = useState();

  const isAuthInitialized = signInStatus !== 'uninitialized';

  useEffect(() => {
    const fetchData = async () => {
      setFeaturedWorkspaces(await Ajax().FirecloudBucket.getFeaturedWorkspaces());
    };
    if (signInStatus === 'signedOut') {
      fetchData();
    }
  }, [signInStatus]);

  const isFeaturedWorkspace = () => _.some((ws) => ws.namespace === namespace && ws.name === name, featuredWorkspaces);

  return Utils.cond(
    [
      !isAuthInitialized || (signInStatus === 'signedOut' && featuredWorkspaces === undefined),
      () => h(centeredSpinner, { style: { position: 'fixed' } }),
    ],
    [signInStatus === 'signedOut' && isFeaturedWorkspace(), () => h(DashboardPublic, props)],
    [signInStatus === 'signedOut', () => h(SignIn)],
    () => h(WorkspaceDashboard, props)
  );
};

const RightBoxSection = ({ title, info, initialOpenState, afterTitle, onClick, children }) => {
  return div({ style: { paddingTop: '1rem' } }, [
    div({ style: Style.dashboard.rightBoxContainer }, [
      h(
        Collapse,
        {
          title: h3({ style: Style.dashboard.collapsibleHeader }, [title, info]),
          summaryStyle: { color: colors.accent() },
          initialOpenState,
          titleFirst: true,
          afterTitle,
          onClick,
        },
        [children]
      ),
    ]),
  ]);
};

export const BucketLocation = requesterPaysWrapper({ onDismiss: _.noop })(({ workspace, storageDetails }) => {
  console.assert(!!workspace && isGoogleWorkspace(workspace), 'BucketLocation expects a Google workspace');
  const [loading, setLoading] = useState(true);
  const [{ location, locationType }, setBucketLocation] = useState({ location: undefined, locationType: undefined });
  const [needsRequesterPaysProject, setNeedsRequesterPaysProject] = useState(false);
  const [showRequesterPaysModal, setShowRequesterPaysModal] = useState(false);

  const signal = useCancellation();
  const loadGoogleBucketLocation = useCallback(async () => {
    setLoading(true);
    try {
      const {
        namespace,
        name,
        workspace: { googleProject, bucketName },
      } = workspace;
      const response = await Ajax(signal).Workspaces.workspace(namespace, name).checkBucketLocation(googleProject, bucketName);
      setBucketLocation(response);
    } catch (error) {
      if (error.requesterPaysError) {
        setNeedsRequesterPaysProject(true);
      } else {
        reportError('Unable to get bucket location.', error);
      }
    } finally {
      setLoading(false);
    }
  }, [workspace, signal]);

  useEffect(() => {
    if (workspace?.workspaceInitialized) {
      if (storageDetails.fetchedGoogleBucketLocation === 'ERROR') {
        // storageDetails.fetchedGoogleBucketLocation stores if an error was encountered from the server,
        // while storageDetails.googleBucketLocation will contain the default value.
        // In the case of requester pays workspaces, we wish to show the user more information in this case and allow them to link a workspace.
        loadGoogleBucketLocation();
      } else if (storageDetails.fetchedGoogleBucketLocation === 'SUCCESS') {
        setBucketLocation({ location: storageDetails.googleBucketLocation, locationType: storageDetails.googleBucketType });
        setLoading(false);
      }
    }
  }, [
    loadGoogleBucketLocation,
    setBucketLocation,
    // Explicit dependencies to avoid extra calls to loadGoogleBucketLocation
    workspace?.workspaceInitialized,
    storageDetails.fetchedGoogleBucketLocation,
    storageDetails.googleBucketLocation,
    storageDetails.googleBucketType,
  ]);

  if (loading) {
    return 'Loading';
  }

  if (!location) {
    return h(Fragment, [
      'Unknown',
      needsRequesterPaysProject &&
        h(
          ButtonSecondary,
          {
            'aria-label': 'Load bucket location',
            tooltip: "This workspace's bucket is requester pays. Click to choose a workspace to bill requests to and get the bucket's location.",
            style: { height: '1rem', marginLeft: '1ch' },
            onClick: () => setShowRequesterPaysModal(true),
          },
          [icon('sync')]
        ),
      showRequesterPaysModal &&
        h(RequesterPaysModal, {
          onDismiss: () => setShowRequesterPaysModal(false),
          onSuccess: (selectedGoogleProject) => {
            requesterPaysProjectStore.set(selectedGoogleProject);
            setShowRequesterPaysModal(false);
            loadGoogleBucketLocation();
          },
        }),
    ]);
  }

  const { flag, regionDescription } = getRegionInfo(location, locationType);
  return h(TooltipCell, [flag, ' ', regionDescription]);
});

export const AzureStorageDetails = ({ azureContext, storageDetails }) => {
  return h(Fragment, [
    h(InfoRow, { title: 'Cloud Name' }, [h(AzureLogo, { title: 'Microsoft Azure', role: 'img', style: { height: 16 } })]),
    h(InfoRow, { title: 'Location' }, [
      h(
        TooltipCell,
        storageDetails.azureContainerRegion
          ? [getRegionFlag(storageDetails.azureContainerRegion), ' ', getRegionLabel(storageDetails.azureContainerRegion)]
          : ['Loading']
      ),
    ]),
    h(InfoRow, { title: 'Resource Group ID' }, [
      h(TooltipCell, [azureContext.managedResourceGroupId]),
      h(ClipboardButton, {
        'aria-label': 'Copy resource group id to clipboard',
        text: azureContext.managedResourceGroupId,
        style: { marginLeft: '0.25rem' },
      }),
    ]),
    h(InfoRow, { title: 'Storage Container URL' }, [
      h(TooltipCell, [storageDetails.azureContainerUrl ? storageDetails.azureContainerUrl : 'Loading']),
      h(ClipboardButton, {
        'aria-label': 'Copy storage container URL to clipboard',
        text: storageDetails.azureContainerUrl,
        style: { marginLeft: '0.25rem' },
      }),
    ]),
    h(InfoRow, { title: 'Storage SAS URL' }, [
      h(TooltipCell, [storageDetails.azureContainerSasUrl ? storageDetails.azureContainerSasUrl : 'Loading']),
      h(ClipboardButton, {
        'aria-label': 'Copy SAS URL to clipboard',
        text: storageDetails.azureContainerSasUrl,
        style: { marginLeft: '0.25rem' },
      }),
    ]),
  ]);
};

export const WorkspaceInformation = ({ workspace }) => {
  return dl({}, [
    h(InfoRow, { title: 'Last Updated' }, [new Date(workspace.workspace.lastModified).toLocaleDateString()]),
    h(InfoRow, { title: 'Creation Date' }, [new Date(workspace.workspace.createdDate).toLocaleDateString()]),
    h(InfoRow, { title: 'Access Level' }, [roleString[workspace.accessLevel]]),
    hasProtectedData(workspace) &&
      h(InfoRow, { title: 'Workspace Protected' }, ['Yes', h(InfoBox, { style: { marginLeft: '0.50rem' }, side: 'bottom' }, [protectedDataMessage])]),
    hasRegionConstraint(workspace) &&
      h(InfoRow, { title: 'Region Constraint' }, [
        'Yes',
        h(InfoBox, { style: { marginLeft: '0.50rem' }, side: 'bottom' }, [regionConstraintMessage(workspace)]),
      ]),
  ]);
};

export const WorkspaceNotifications = ({ workspace }) => {
  const {
    workspace: { namespace, name },
  } = workspace;

  const [saving, setSaving] = useState(false);

  const notificationsPreferences = _.pickBy((_v, k) => _.startsWith('notifications/', k), authStore.get().profile);

  const submissionNotificationKeys = [
    `notifications/SuccessfulSubmissionNotification/${namespace}/${name}`,
    `notifications/FailedSubmissionNotification/${namespace}/${name}`,
    `notifications/AbortedSubmissionNotification/${namespace}/${name}`,
  ];

  const submissionNotificationsEnabled = !_.isMatch(_.fromPairs(_.map((k) => [k, 'false'], submissionNotificationKeys)), notificationsPreferences);

  return div({ style: { margin: '0.5rem' } }, [
    div({ style: { display: 'flex', alignItems: 'center' } }, [
      h(
        LabeledCheckbox,
        {
          checked: submissionNotificationsEnabled,
          disabled: saving,
          onChange: _.flow(
            Utils.withBusyState(setSaving),
            withErrorReporting('Error saving preferences')
          )(async (value) => {
            await Ajax().User.profile.setPreferences(_.fromPairs(_.map((k) => [k, JSON.stringify(value)], submissionNotificationKeys)));
            await refreshTerraProfile();
            Ajax().Metrics.captureEvent(Events.notificationToggle, { notificationKeys: submissionNotificationKeys, enabled: value });
          }),
        },
        [span({ style: { marginLeft: '1ch' } }, ['Receive submission notifications'])]
      ),
      h(InfoBox, { style: { marginLeft: '1ch' } }, [
        'Receive email notifications when a submission in this workspace has succeeded, failed, or been aborted.',
      ]),
      saving && spinner({ size: 12, style: { marginLeft: '1ch' } }),
    ]),
  ]);
};

const WorkspaceDashboard = _.flow(
  forwardRefWithName('WorkspaceDashboard'),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceDashboard(props),
    activeTab: 'dashboard',
    title: 'Dashboard',
  })
)(
  (
    {
      namespace,
      name,
      refreshWorkspace,
      storageDetails,
      workspace,
      workspace: {
        accessLevel,
        azureContext,
        owners,
        workspace: {
          authorizationDomain,
          bucketName,
          googleProject,
          attributes,
          attributes: { description = '' },
        },
      },
    },
    ref
  ) => {
    // State
    const [storageCost, setStorageCost] = useState(undefined);
    const [bucketSize, setBucketSize] = useState(undefined);
    const [editDescription, setEditDescription] = useState(undefined);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState(false);
    const [consentStatus, setConsentStatus] = useState(undefined);
    const [tagsList, setTagsList] = useState(undefined);
    const [acl, setAcl] = useState(undefined);

    const persistenceId = `workspaces/${namespace}/${name}/dashboard`;

    const signal = useCancellation();

    const refresh = () => {
      loadConsent();
      loadWsTags();

      // If the current user is the only owner of the workspace, load the ACL to check if the workspace is shared.
      if (isOwner(accessLevel) && _.size(owners) === 1) {
        loadAcl();
      }

      updateGoogleBucketDetails(workspace);
    };

    const loadStorageCost = useMemo(
      () =>
        withErrorReporting('Error loading storage cost data', async () => {
          try {
            const { estimate, lastUpdated } = await Ajax(signal).Workspaces.workspace(namespace, name).storageCostEstimate();
            setStorageCost({ isSuccess: true, estimate, lastUpdated });
          } catch (error) {
            if (error.status === 404) {
              setStorageCost({ isSuccess: false, estimate: 'Not available' });
            } else {
              throw error;
            }
          }
        }),
      [namespace, name, signal]
    );

    const loadBucketSize = useMemo(
      () =>
        withErrorReporting('Error loading bucket size.', async () => {
          try {
            const { usageInBytes, lastUpdated } = await Ajax(signal).Workspaces.workspace(namespace, name).bucketUsage();
            setBucketSize({ isSuccess: true, usage: Utils.formatBytes(usageInBytes), lastUpdated });
          } catch (error) {
            if (error.status === 404) {
              setBucketSize({ isSuccess: false, usage: 'Not available' });
            } else {
              throw error;
            }
          }
        }),
      [namespace, name, signal]
    );

    const updateGoogleBucketDetails = useCallback(
      (workspace) => {
        if (isGoogleWorkspace(workspace) && workspace.workspaceInitialized && canWrite(accessLevel)) {
          loadStorageCost();
          loadBucketSize();
        }
      },
      [accessLevel, loadStorageCost, loadBucketSize]
    );

    useEffect(() => {
      updateGoogleBucketDetails(workspace);
    }, [workspace, updateGoogleBucketDetails]);

    useImperativeHandle(ref, () => ({ refresh }));

    const [workspaceInfoPanelOpen, setWorkspaceInfoPanelOpen] = useState(() => getLocalPref(persistenceId)?.workspaceInfoPanelOpen);
    const [cloudInfoPanelOpen, setCloudInfoPanelOpen] = useState(() => getLocalPref(persistenceId)?.cloudInfoPanelOpen || false);
    const [ownersPanelOpen, setOwnersPanelOpen] = useState(() => getLocalPref(persistenceId)?.ownersPanelOpen || false);
    const [authDomainPanelOpen, setAuthDomainPanelOpen] = useState(() => getLocalPref(persistenceId)?.authDomainPanelOpen || false);
    const [tagsPanelOpen, setTagsPanelOpen] = useState(() => getLocalPref(persistenceId)?.tagsPanelOpen || false);
    const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(() => getLocalPref(persistenceId)?.notificationsPanelOpen || false);

    useEffect(() => {
      setLocalPref(persistenceId, {
        workspaceInfoPanelOpen,
        cloudInfoPanelOpen,
        ownersPanelOpen,
        authDomainPanelOpen,
        tagsPanelOpen,
        notificationsPanelOpen,
      });
    }, [persistenceId, workspaceInfoPanelOpen, cloudInfoPanelOpen, ownersPanelOpen, authDomainPanelOpen, tagsPanelOpen, notificationsPanelOpen]);

    // Helpers
    const loadConsent = withErrorReporting('Error loading data', async () => {
      const orspId = attributes['library:orsp'];
      if (orspId) {
        try {
          const { translatedUseRestriction } = await Ajax(signal).Duos.getConsent(orspId);
          setConsentStatus(translatedUseRestriction);
        } catch (error) {
          switch (error.status) {
            case 400:
              setConsentStatus(`Structured Data Use Limitations are not approved for ${orspId}`);
              break;
            case 404:
              setConsentStatus(`Structured Data Use Limitations are not available for ${orspId}`);
              break;
            default:
              throw error;
          }
        }
      }
    });

    const loadWsTags = withErrorReporting('Error loading workspace tags', async () => {
      setTagsList(await Ajax(signal).Workspaces.workspace(namespace, name).getTags());
    });

    const addTag = _.flow(
      withErrorReporting('Error adding tag'),
      Utils.withBusyState(setBusy)
    )(async (tag) => {
      setTagsList(await Ajax().Workspaces.workspace(namespace, name).addTag(tag));
    });

    const deleteTag = _.flow(
      withErrorReporting('Error removing tag'),
      Utils.withBusyState(setBusy)
    )(async (tag) => {
      setTagsList(await Ajax().Workspaces.workspace(namespace, name).deleteTag(tag));
    });

    const loadAcl = withErrorReporting('Error loading ACL', async () => {
      const { acl } = await Ajax(signal).Workspaces.workspace(namespace, name).getAcl();
      setAcl(acl);
    });

    const save = Utils.withBusyState(setSaving, async () => {
      try {
        await Ajax().Workspaces.workspace(namespace, name).shallowMergeNewAttributes({ description: editDescription });
        await refreshWorkspace();
      } catch (error) {
        reportError('Error saving workspace', error);
      } finally {
        setEditDescription(undefined);
      }
    });

    // Lifecycle
    useOnMount(() => {
      refresh();
    });

    const oneOwnerNotice = Utils.cond(
      // No warning if there are multiple owners.
      [_.size(owners) !== 1, () => null],
      // If the current user does not own the workspace, then then workspace must be shared.
      [
        !isOwner(accessLevel),
        () =>
          h(Fragment, [
            'This shared workspace has only one owner. Consider requesting ',
            h(Link, { mailto: owners[0] }, [owners[0]]),
            ' to add another owner to ensure someone is able to manage the workspace in case they lose access to their account.',
          ]),
      ],
      // If the current user is the only owner of the workspace, check if the workspace is shared.
      [
        _.size(acl) > 1,
        () =>
          'You are the only owner of this shared workspace. Consider adding another owner to ensure someone is able to manage the workspace in case you lose access to your account.',
      ]
    );

    const getCloudInformation = () => {
      return !isAzureWorkspace(workspace) && !isGoogleWorkspace(workspace)
        ? []
        : [
            dl(
              isGoogleWorkspace(workspace)
                ? [
                    h(InfoRow, { title: 'Cloud Name' }, [h(GcpLogo, { title: 'Google Cloud Platform', role: 'img', style: { height: 16 } })]),
                    h(InfoRow, { title: 'Location' }, [h(BucketLocation, { workspace, storageDetails })]),
                    h(InfoRow, { title: 'Google Project ID' }, [
                      h(TooltipCell, [googleProject]),
                      h(ClipboardButton, {
                        'aria-label': 'Copy google project id to clipboard',
                        text: googleProject,
                        style: { marginLeft: '0.25rem' },
                      }),
                    ]),
                    h(InfoRow, { title: 'Bucket Name' }, [
                      h(TooltipCell, [bucketName]),
                      h(ClipboardButton, { 'aria-label': 'Copy bucket name to clipboard', text: bucketName, style: { marginLeft: '0.25rem' } }),
                    ]),
                    canWrite(accessLevel) &&
                      h(
                        InfoRow,
                        {
                          title: 'Estimated Storage Cost',
                          subtitle: Utils.cond(
                            [!storageCost, () => 'Loading last updated...'],
                            [storageCost?.isSuccess, () => `Updated on ${new Date(storageCost.lastUpdated).toLocaleDateString()}`]
                          ),
                        },
                        [storageCost?.estimate || '$ ...']
                      ),
                    canWrite(accessLevel) &&
                      h(
                        InfoRow,
                        {
                          title: 'Bucket Size',
                          subtitle: Utils.cond(
                            [!bucketSize, () => 'Loading last updated...'],
                            [bucketSize?.isSuccess, () => `Updated on ${new Date(bucketSize.lastUpdated).toLocaleDateString()}`]
                          ),
                        },
                        [bucketSize?.usage]
                      ),
                  ]
                : [h(AzureStorageDetails, { azureContext, storageDetails })]
            ),
            isGoogleWorkspace(workspace) &&
              h(Fragment, [
                div({ style: { paddingBottom: '0.5rem' } }, [
                  h(
                    Link,
                    {
                      style: { margin: '1rem 0.5rem' },
                      ...Utils.newTabLinkProps,
                      onClick: () => {
                        Ajax().Metrics.captureEvent(Events.workspaceOpenedBucketInBrowser, {
                          ...extractWorkspaceDetails(workspace),
                        });
                      },
                      href: bucketBrowserUrl(bucketName),
                    },
                    ['Open bucket in browser', icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })]
                  ),
                ]),
                div({ style: { paddingBottom: '0.5rem' } }, [
                  h(
                    Link,
                    {
                      style: { margin: '1rem 0.5rem' },
                      ...Utils.newTabLinkProps,
                      onClick: () => {
                        Ajax().Metrics.captureEvent(Events.workspaceOpenedProjectInConsole, {
                          ...extractWorkspaceDetails(workspace),
                        });
                      },
                      href: `https://console.cloud.google.com/welcome?project=${googleProject}`,
                    },
                    ['Open project in Google Cloud Console', icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })]
                  ),
                ]),
              ]),
            isAzureWorkspace(workspace) &&
              div({ style: { margin: '0.5rem', fontSize: 12 } }, [
                div([
                  'Use SAS URL in conjunction with ',
                  h(
                    Link,
                    {
                      ...Utils.newTabLinkProps,
                      href: 'https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-v10',
                      style: { textDecoration: 'underline' },
                    },
                    'AzCopy'
                  ),
                  ' or ',
                  h(
                    Link,
                    {
                      ...Utils.newTabLinkProps,
                      href: 'https://azure.microsoft.com/en-us/products/storage/storage-explorer',
                      style: { textDecoration: 'underline' },
                    },
                    'Azure Storage Explorer'
                  ),
                  ' to access storage associated with this workspace.',
                ]),
                div({ style: { paddingTop: '0.5rem', fontWeight: 'bold' } }, [
                  'The SAS URL expires after 8 hours. To generate a new SAS URL, refresh this page.',
                ]),
              ]),
          ];
    };

    // Render
    const isEditing = _.isString(editDescription);
    const brand = getEnabledBrand();
    const { value: canEdit, message: editErrorMessage } = canEditWorkspace(workspace);

    return div({ style: { flex: 1, display: 'flex' } }, [
      div({ style: Style.dashboard.leftBox }, [
        div({ style: Style.dashboard.header }, [
          'About the workspace',
          !isEditing &&
            h(
              Link,
              {
                style: { marginLeft: '0.5rem' },
                disabled: !canEdit,
                tooltip: editErrorMessage || 'Edit description',
                onClick: () => setEditDescription(description?.toString()),
              },
              [icon('edit')]
            ),
        ]),
        Utils.cond(
          [
            isEditing,
            () =>
              h(Fragment, [
                h(MarkdownEditor, {
                  placeholder: 'Enter a description',
                  value: editDescription,
                  onChange: setEditDescription,
                }),
                div({ style: { display: 'flex', justifyContent: 'flex-end', margin: '1rem' } }, [
                  h(ButtonSecondary, { onClick: () => setEditDescription(undefined) }, 'Cancel'),
                  h(ButtonPrimary, { style: { marginLeft: '1rem' }, onClick: save }, 'Save'),
                ]),
                saving && spinnerOverlay,
              ]),
          ],
          [!!description, () => h(MarkdownViewer, [description?.toString()])],
          () => div({ style: { fontStyle: 'italic' } }, ['No description added'])
        ),
        _.some(_.startsWith('library:'), _.keys(attributes)) &&
          h(Fragment, [
            div({ style: Style.dashboard.header }, ['Dataset Attributes']),
            h(SimpleTable, {
              'aria-label': 'dataset attributes table',
              rows: _.flow(
                _.map(({ key, title }) => ({ name: title, value: displayAttributeValue(attributes[key]) })),
                Utils.append({
                  name: 'Structured Data Use Limitations',
                  value: attributes['library:orsp'] ? consentStatus : h(DataUseLimitations, { attributes }),
                }),
                _.filter('value')
              )(displayLibraryAttributes),
              columns: [
                { key: 'name', size: { grow: 1 } },
                { key: 'value', size: { grow: 2 } },
              ],
            }),
          ]),
      ]),
      div({ style: Style.dashboard.rightBox }, [
        h(
          RightBoxSection,
          {
            title: 'Workspace information',
            initialOpenState: workspaceInfoPanelOpen !== undefined ? workspaceInfoPanelOpen : true,
            onClick: () => setWorkspaceInfoPanelOpen(workspaceInfoPanelOpen === undefined ? false : !workspaceInfoPanelOpen),
          },
          [h(WorkspaceInformation, { workspace })]
        ),
        h(
          RightBoxSection,
          {
            title: 'Cloud information',
            initialOpenState: cloudInfoPanelOpen,
            onClick: () => setCloudInfoPanelOpen(!cloudInfoPanelOpen),
          },
          getCloudInformation()
        ),
        h(
          RightBoxSection,
          {
            title: 'Owners',
            initialOpenState: ownersPanelOpen,
            afterTitle:
              oneOwnerNotice &&
              h(
                InfoBox,
                {
                  iconOverride: 'error-standard',
                  style: { color: colors.accent() },
                },
                [oneOwnerNotice]
              ),
            onClick: () => setOwnersPanelOpen(!ownersPanelOpen),
          },
          [
            div(
              { style: { margin: '0.5rem' } },
              _.map((email) => {
                return div({ key: email, style: { overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.5rem' } }, [
                  h(Link, { href: `mailto:${email}` }, [email]),
                ]);
              }, owners)
            ),
          ]
        ),
        !_.isEmpty(authorizationDomain) &&
          h(
            RightBoxSection,
            {
              title: 'Authorization domain',
              initialOpenState: authDomainPanelOpen,
              onClick: () => setAuthDomainPanelOpen(!authDomainPanelOpen),
            },
            [
              div({ style: { margin: '0.5rem 0.5rem 1rem 0.5rem' } }, [
                'Collaborators must be a member of all of these ',
                h(
                  Link,
                  {
                    href: Nav.getLink('groups'),
                    ...Utils.newTabLinkProps,
                  },
                  'groups'
                ),
                ' to access this workspace.',
              ]),
              ..._.map(({ membersGroupName }) => div({ style: { margin: '0.5rem', fontWeight: 500 } }, [membersGroupName]), authorizationDomain),
            ]
          ),
        h(
          RightBoxSection,
          {
            title: 'Tags',
            info: span({}, [(busy || !tagsList) && tagsPanelOpen && spinner({ size: '1ch', style: { marginLeft: '0.5rem' } })]),
            initialOpenState: tagsPanelOpen,
            onClick: () => setTagsPanelOpen(!tagsPanelOpen),
          },
          [
            div({ style: { margin: '0.5rem' } }, [
              div({ style: { marginBottom: '0.5rem', fontSize: 12 } }, [
                `${brand.name} is not intended to host personally identifiable information.`,
                h(InfoBox, { style: { marginLeft: '0.25rem' } }, [
                  `${brand.name} is not intended to host personally identifiable information. Do not use any patient identifier including name,
              social security number, or medical record number.`,
                ]),
              ]),
              canEdit &&
                div({ style: { marginBottom: '0.5rem' } }, [
                  h(WorkspaceTagSelect, {
                    menuShouldScrollIntoView: false,
                    value: null,
                    placeholder: 'Add a tag',
                    'aria-label': 'Add a tag',
                    onChange: ({ value }) => addTag(value),
                  }),
                ]),
              div({ style: { display: 'flex', flexWrap: 'wrap', minHeight: '1.5rem' } }, [
                _.map((tag) => {
                  return span({ key: tag, style: styles.tag }, [
                    tag,
                    canEdit &&
                      h(
                        Link,
                        {
                          tooltip: 'Remove tag',
                          disabled: busy,
                          onClick: () => deleteTag(tag),
                          style: { marginLeft: '0.25rem', verticalAlign: 'middle', display: 'inline-block' },
                        },
                        [icon('times', { size: 14 })]
                      ),
                  ]);
                }, tagsList),
                !!tagsList && _.isEmpty(tagsList) && i(['No tags yet']),
              ]),
            ]),
          ]
        ),
        h(
          RightBoxSection,
          {
            title: 'Notifications',
            initialOpenState: notificationsPanelOpen,
            onClick: () => setNotificationsPanelOpen(!notificationsPanelOpen),
          },
          [h(WorkspaceNotifications, { workspace })]
        ),
      ]),
    ]);
  }
);

export const navPaths = [
  {
    name: 'workspace-dashboard',
    path: '/workspaces/:namespace/:name',
    component: DashboardAuthContainer,
    title: ({ name }) => `${name} - Dashboard`,
    public: true,
  },
];
