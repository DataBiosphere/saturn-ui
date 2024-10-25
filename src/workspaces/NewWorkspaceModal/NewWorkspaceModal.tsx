import { Icon, Modal, TooltipTrigger } from '@terra-ui-packages/components';
import { delay } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import React, { ReactNode, useState } from 'react';
import { defaultLocation } from 'src/analysis/utils/runtime-utils';
import { AzureBillingProject, BillingProject, CloudPlatform, GCPBillingProject } from 'src/billing-core/models';
import { supportsPhiTracking } from 'src/billing-core/utils';
import { CloudProviderIcon } from 'src/components/CloudProviderIcon';
import {
  ButtonPrimary,
  IdContainer,
  LabeledCheckbox,
  Link,
  Select,
  spinnerOverlay,
  VirtualizedSelect,
} from 'src/components/common';
import { InfoBox } from 'src/components/InfoBox';
import { TextArea, ValidatedInput } from 'src/components/input';
import { allRegions, availableBucketRegions, isSupportedBucketLocation } from 'src/components/region-common';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { Billing } from 'src/libs/ajax/billing/Billing';
import { resolveWdsApp } from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { Groups } from 'src/libs/ajax/Groups';
import { CurrentUserGroupMembership } from 'src/libs/ajax/Groups';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Metrics } from 'src/libs/ajax/Metrics';
import { WorkspaceData } from 'src/libs/ajax/WorkspaceDataService';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { getRegionLabel } from 'src/libs/azure-utils';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import { reportErrorAndRethrow, withErrorReportingInModal } from 'src/libs/error';
import Events, { extractCrossWorkspaceDetails, extractWorkspaceDetails } from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import * as Nav from 'src/libs/nav';
import { useCancellation, useOnMount, withDisplayName } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { CloneEgressWarning } from 'src/workspaces/NewWorkspaceModal/CloneEgressWarning';
import { CreatingWorkspaceMessage } from 'src/workspaces/NewWorkspaceModal/CreatingWorkspaceMessage';
import {
  cloudProviderLabels,
  hasPhiTrackingPolicy,
  isAzureWorkspace,
  isGoogleWorkspace,
  isProtectedWorkspace,
  phiTrackingPolicy,
  protectedDataIcon,
  protectedDataLabel,
  protectedDataMessage,
  WorkspaceInfo,
  WorkspaceWrapper,
} from 'src/workspaces/utils';
import { LinkWithPopout } from 'src/workspaces/WorkspacePolicies/LinkWithPopout';
import { WorkspacePolicies, WorkspacePoliciesProps } from 'src/workspaces/WorkspacePolicies/WorkspacePolicies';
import validate from 'validate.js';

const constraints = {
  name: {
    presence: { allowEmpty: false },
    length: { maximum: 254 },
    format: {
      pattern: /[\w- ]*/,
      message: 'can only contain letters, numbers, dashes, underscores, and spaces',
    },
  },
  namespace: {
    presence: true,
  },
};

const invalidBillingAccountMsg =
  'Workspaces may only be created in billing projects that have a Google billing account accessible in Terra';

const ariaInvalidBillingAccountMsg = (invalidBillingAccount: boolean): string => {
  return invalidBillingAccount ? ` with warning "${invalidBillingAccountMsg}"` : '';
};

export interface NewWorkspaceModalProps {
  buttonText?: string;
  cloneWorkspace?: WorkspaceWrapper;
  cloudPlatform?: CloudPlatform;
  renderNotice?: (args: { selectedBillingProject?: BillingProject }) => ReactNode;
  requiredAuthDomain?: string;
  requireEnhancedBucketLogging?: boolean;
  title?: string;
  waitForServices?: {
    wds?: boolean;
  };
  workflowImport?: boolean;
  onDismiss: () => void;
  onSuccess: (newWorkspace: WorkspaceInfo) => void;
}

export const NewWorkspaceModal = withDisplayName(
  'NewWorkspaceModal',
  ({
    cloneWorkspace,
    cloudPlatform,
    onSuccess,
    onDismiss,
    renderNotice = () => null,
    requiredAuthDomain,
    requireEnhancedBucketLogging,
    title,
    buttonText,
    waitForServices,
    workflowImport,
  }: NewWorkspaceModalProps) => {
    // State
    const [billingProjects, setBillingProjects] = useState<BillingProject[]>();
    const [azureBillingProjectsExist, setAzureBillingProjectsExist] = useState(false);
    const [allGroups, setAllGroups] = useState<CurrentUserGroupMembership[]>();
    const [name, setName] = useState(cloneWorkspace ? `${cloneWorkspace.workspace.name} copy` : '');
    const [namespace, setNamespace] = useState(cloneWorkspace ? cloneWorkspace.workspace.namespace : undefined);
    const [description, setDescription] = useState(cloneWorkspace?.workspace.attributes?.description || '');
    const [groups, setGroups] = useState<string[]>([]);
    const [enhancedBucketLogging, setEnhancedBucketLogging] = useState(!!requireEnhancedBucketLogging);
    const [nameModified, setNameModified] = useState(false);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string>();
    const [bucketLocation, setBucketLocation] = useState(defaultLocation);
    const [sourceAzureWorkspaceRegion, setSourceAzureWorkspaceRegion] = useState<string>('');
    const [sourceGCPWorkspaceRegion, setSourceGcpWorkspaceRegion] = useState<string>(defaultLocation);
    const [sourceGCPWorkspaceRegionError, setSourceGCPWorkspaceRegionError] = useState(false);
    const [isAlphaRegionalityUser, setIsAlphaRegionalityUser] = useState(false);
    const [phiTracking, setPhiTracking] = useState<boolean | undefined>(undefined);
    const signal = useCancellation();

    // Helpers
    const getRequiredGroups = (): string[] =>
      _.uniq([
        ...(cloneWorkspace ? _.map('membersGroupName', cloneWorkspace.workspace.authorizationDomain) : []),
        ...(requiredAuthDomain ? [requiredAuthDomain] : []),
      ]);

    const loadAlphaRegionalityUser = reportErrorAndRethrow('Error loading regionality group membership')(async () => {
      setIsAlphaRegionalityUser(await Groups(signal).group(getConfig().alphaRegionalityGroup).isMember());
    });

    const create = async (): Promise<void> => {
      try {
        setCreateError(undefined);
        setCreating(true);

        const body = {
          namespace: namespace!,
          name,
          authorizationDomain: _.map((v) => ({ membersGroupName: v }), [...getRequiredGroups(), ...groups]),
          attributes: { description },
          copyFilesWithPrefix: isGoogleBillingProject() ? 'notebooks/' : 'analyses/',
          ...(!!bucketLocation && isGoogleBillingProject() && { bucketLocation }),
          enhancedBucketLogging,
          ...(phiTracking && { policies: [phiTrackingPolicy] }),
        };

        const createdWorkspace = await Utils.cond(
          [
            !!cloneWorkspace,
            async () => {
              const workspace: WorkspaceInfo = await Workspaces()
                .workspaceV2(cloneWorkspace!.workspace.namespace, cloneWorkspace!.workspace.name)
                .clone(body);
              const featuredList = await FirecloudBucket().getFeaturedWorkspaces();
              const metricsData = {
                featured: _.some(
                  { namespace: cloneWorkspace!.workspace.namespace, name: cloneWorkspace!.workspace.name },
                  featuredList
                ),
                ...extractCrossWorkspaceDetails(cloneWorkspace!, { workspace }),
                fromWorkspaceRegion: isAzureWorkspace(cloneWorkspace!)
                  ? sourceAzureWorkspaceRegion
                  : sourceGCPWorkspaceRegion,
                toWorkspaceRegion: isAzureBillingProject(selectedBillingProject)
                  ? selectedBillingProject.region
                  : bucketLocation,
              };
              void Metrics().captureEvent(Events.workspaceClone, metricsData);
              return workspace;
            },
          ],
          async () => {
            const workspace = await Workspaces().create(body);
            const metricsData = {
              ...extractWorkspaceDetails(workspace),
              region: isAzureBillingProject(selectedBillingProject) ? selectedBillingProject.region : bucketLocation,
            };
            void Metrics().captureEvent(Events.workspaceCreate, metricsData);
            return workspace;
          }
        );

        if (getProjectCloudPlatform() === 'AZURE' && waitForServices?.wds) {
          // WDS takes some time to start up, so there's no need to immediately start checking if it's running.
          await delay(30000);

          // Wait for the WDS app to be running.
          const wds = await Utils.poll(
            async () => {
              const workspaceApps: ListAppItem[] = await Apps().listAppsV2(createdWorkspace.workspaceId);
              const wdsApp = resolveWdsApp(workspaceApps);
              if (wdsApp?.status === 'RUNNING') {
                return { shouldContinue: false, result: wdsApp };
              }
              if (wdsApp?.status === 'ERROR') {
                throw new Error('Failed to provision data services for new workspace.');
              }
              return { shouldContinue: true, result: null };
            },
            15000,
            true
          );

          // Wait for the default WDS collection to exist.
          const proxyUrl = wds!.proxyUrls.wds;
          await Utils.poll(
            async () => {
              const collections: string[] = await WorkspaceData().listCollections(
                proxyUrl,
                createdWorkspace.workspaceId
              );

              // Explicitly check that a collection exists with the same ID as this workspace.
              // It is by convention only that the workspace's ID is the same as its collection ID.
              // We have to perform this check as long as this component relies on that convention,
              // because the API itself isn't guaranteed to return a collection with the same ID as the workspace.
              if (collections.includes(createdWorkspace.workspaceId)) {
                return { shouldContinue: false, result: true };
              }
              return { shouldContinue: true, result: false };
            },
            5000,
            true
          );
        }
        onSuccess(createdWorkspace);
      } catch (error: unknown) {
        const errorMessage = await (async () => {
          if (error instanceof Response) {
            try {
              const { message } = await error.json();
              return message || 'Unknown error.';
            } catch (readResponseError) {
              return 'Unknown error.';
            }
          }
          if (error instanceof Error) {
            return error.message;
          }
          return 'Unknown error.';
        })();
        setCreating(false);
        setCreateError(errorMessage);
      }
    };

    const loadData = _.flow(
      withErrorReportingInModal('Error loading data', onDismiss),
      Utils.withBusyState(setLoading)
    )(() =>
      Promise.all([
        Billing(signal)
          .listProjects()
          .then(_.filter({ status: 'Ready' }))
          .then(
            _.forEach((project: BillingProject) => {
              if (isAzureBillingProject(project)) {
                setAzureBillingProjectsExist(true);
              }
            })
          )
          .then(_.filter((project: BillingProject) => isBillingProjectApplicable(project)))
          .then((projects: BillingProject[]) => {
            setBillingProjects(projects);
            setNamespace(_.some({ projectName: namespace }, projects) ? namespace : undefined);
          }),
        Groups(signal).list().then(setAllGroups),
        !!cloneWorkspace &&
          Workspaces(signal)
            .workspace(namespace!, cloneWorkspace.workspace.name)
            .details(['workspace.attributes.description'])
            .then((workspace) => {
              setDescription(workspace.workspace.attributes?.description || '');
            }),
        !!cloneWorkspace &&
          isGoogleWorkspace(cloneWorkspace) &&
          Workspaces(signal)
            .workspace(namespace!, cloneWorkspace.workspace.name)
            .checkBucketLocation(cloneWorkspace.workspace.googleProject, cloneWorkspace.workspace.bucketName)
            .then(({ location }) => {
              // For current phased regionality release, we only allow US or NORTHAMERICA-NORTHEAST1 (Montreal) workspace buckets.
              setBucketLocation(isSupportedBucketLocation(location) ? location : defaultLocation);
              setSourceGcpWorkspaceRegion(location);
            })
            .catch((_) => {
              // We cannot get the bucket location in a couple of scenarios:
              // 1. The bucket is requester pays.
              // 2. The user permissions are still syncing.
              // In either case, we will just show a generic egress warning message to prevent the
              // user from being blocked from cloning the workspace.
              setSourceGCPWorkspaceRegionError(true);
              console.log('Error getting the source workspace bucket location'); // eslint-disable-line no-console
            }),
        !!cloneWorkspace &&
          isAzureWorkspace(cloneWorkspace) &&
          AzureStorage(signal)
            .containerInfo(cloneWorkspace.workspace.workspaceId)
            .then(({ region }) => {
              setSourceAzureWorkspaceRegion(region);
            })
            .catch((error) => {
              // We don't want to block the user from cloning a workspace if we can't get the region.
              // There is a known transitory state when workspaces are being cloned during which we cannot
              // get the storage container region.
              console.log(`Error getting Azure storage container region: ${error}`); // eslint-disable-line no-console
            }),
      ])
    );

    const isAzureBillingProject = (project?: BillingProject): project is AzureBillingProject =>
      isCloudProviderBillingProject(project, 'AZURE');

    const isGoogleBillingProject = (project?: BillingProject): project is GCPBillingProject =>
      isCloudProviderBillingProject(project, 'GCP');

    const isCloudProviderBillingProject = (
      project: BillingProject | undefined,
      cloudProvider: CloudPlatform
    ): boolean => getProjectCloudPlatform(project) === cloudProvider;

    const selectedBillingProject: BillingProject | undefined = namespace
      ? billingProjects?.find(({ projectName }) => projectName === namespace)
      : undefined;

    const getProjectCloudPlatform = (project?: BillingProject): CloudPlatform | undefined => {
      if (project === undefined) {
        project = selectedBillingProject;
      }
      return project?.cloudPlatform;
    };

    const isBillingProjectApplicable = (project: BillingProject): boolean => {
      // This is used when importing data to enforce a specific cloud.
      if (cloudPlatform && project.cloudPlatform !== cloudPlatform) {
        return false;
      }
      if (workflowImport) {
        return !isAzureBillingProject(project);
      }
      // If we aren't cloning a workspace and enhanced bucket logging is required, allow all GCP projects
      // (user will be forced to select "Workspace will have protected data" for GCP projects)
      // and Azure billing projects that support protected Data.
      if (!cloneWorkspace && requireEnhancedBucketLogging && isAzureBillingProject(project)) {
        return project.protectedData;
      }
      // Only support cloning a workspace to the same cloud platform. If this changes, also update
      // the Events.workspaceClone event data.
      if (!!cloneWorkspace && isAzureWorkspace(cloneWorkspace)) {
        if (isAzureBillingProject(project)) {
          const protectedOk = isProtectedWorkspace(cloneWorkspace) ? project.protectedData : true;
          const phiTrackingOk = hasPhiTrackingPolicy(cloneWorkspace) ? supportsPhiTracking(project) : true;
          return protectedOk && phiTrackingOk;
        }
        return false;
      }
      if (!!cloneWorkspace && isGoogleWorkspace(cloneWorkspace)) {
        return isGoogleBillingProject(project);
      }
      return true;
    };

    const cloningGcpProtectedWorkspace =
      !!cloneWorkspace && isGoogleWorkspace(cloneWorkspace) && isProtectedWorkspace(cloneWorkspace);

    // Lifecycle
    useOnMount(() => {
      // If cloning a GCP protected workspace, override whatever may have been passed via `requireEnhancedBucketLogging`
      if (cloningGcpProtectedWorkspace) {
        setEnhancedBucketLogging(true);
      }
      loadData();
      loadAlphaRegionalityUser();
    });

    // Render
    const existingGroups = getRequiredGroups();
    const hasBillingProjects = !!billingProjects && !!billingProjects.length;
    const errors = validate({ namespace, name }, constraints, {
      prettify: (v) => ({ namespace: 'Billing project', name: 'Name' }[v] || validate.prettify(v)),
    });

    const onFocusAria = ({ focused, isDisabled }) => {
      return `${isDisabled ? 'Disabled option ' : 'Option '}${focused['aria-label']}, focused.`;
    };

    const onChangeAria = ({ value }) => {
      return !value ? '' : `Option ${value['aria-label']} selected.`;
    };

    const endingNotice = renderNotice ? renderNotice({ selectedBillingProject }) : undefined;

    const renderPolicyAndWorkspaceInfo = () => {
      if (isAzureBillingProject() || (!!cloneWorkspace && isAzureWorkspace(cloneWorkspace))) {
        const workspacePoliciesProps: WorkspacePoliciesProps = {
          workspace: cloneWorkspace,
          billingProject: selectedBillingProject,
          endingNotice: (
            <div>
              {endingNotice}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto auto',
                  fontWeight: 600,
                  paddingTop: endingNotice ? '1.0rem' : 0,
                }}
              >
                <Icon icon='warning-standard' size={18} style={{ marginRight: '0.5rem', color: colors.warning() }} />
                <div>
                  Creating a workspace may increase your infrastructure costs
                  <LinkWithPopout href='https://support.terra.bio/hc/en-us/articles/12029087819291'>
                    Learn more about cost and follow changes
                  </LinkWithPopout>
                  ,
                </div>
              </div>
            </div>
          ),
        };
        // Allow toggling PHI tracking if:
        // 1. Creating a new workspace and the billing project supports PHI tracking.
        // 2. Cloning a workspace without PHI tracking to a billing project that supports PHI tracking.
        // Note: when cloning a workspace with PHI tracking already enabled, the policy is inherited and cannot be changed
        if (
          !!selectedBillingProject &&
          supportsPhiTracking(selectedBillingProject) &&
          (!cloneWorkspace || !hasPhiTrackingPolicy(cloneWorkspace))
        ) {
          workspacePoliciesProps.onTogglePhiTracking = (selected: boolean) => setPhiTracking(selected);
          workspacePoliciesProps.togglePhiTrackingChecked = phiTracking;
        }
        return <WorkspacePolicies {...workspacePoliciesProps} />;
      }

      // If we display the Azure policy/workspace section, we render the optional notice within that block
      return endingNotice ? <div style={{ ...Style.elements.noticeContainer }}>{endingNotice}</div> : undefined;
    };

    return Utils.cond(
      [loading, () => spinnerOverlay],
      [
        hasBillingProjects,
        () => (
          <Modal
            title={Utils.cond(
              [!!title, () => title],
              [!!cloneWorkspace && creating, () => 'Cloning workspace'],
              [creating, () => 'Creating workspace'],
              [!!cloneWorkspace, () => 'Clone this workspace'],
              () => 'Create a New Workspace'
            )}
            // Hold modal open while waiting for create workspace request.
            shouldCloseOnOverlayClick={!creating}
            shouldCloseOnEsc={!creating}
            showButtons={!creating}
            onDismiss={onDismiss}
            okButton={
              <ButtonPrimary disabled={errors} tooltip={Utils.summarizeErrors(errors)} onClick={create}>
                {Utils.cond(
                  [!!buttonText, () => buttonText],
                  [!!cloneWorkspace, () => 'Clone Workspace'],
                  () => 'Create Workspace'
                )}
              </ButtonPrimary>
            }
            width={550}
          >
            {creating ? (
              <CreatingWorkspaceMessage />
            ) : (
              <>
                <IdContainer>
                  {(id) => (
                    <>
                      <FormLabel htmlFor={id} required>
                        Workspace name
                      </FormLabel>
                      <ValidatedInput
                        inputProps={{
                          id,
                          autoFocus: true,
                          placeholder: 'Enter a name',
                          value: name,
                          onChange: (v) => {
                            setName(v);
                            setNameModified(true);
                          },
                        }}
                        error={Utils.summarizeErrors(nameModified && errors?.name)}
                      />
                    </>
                  )}
                </IdContainer>
                <IdContainer>
                  {(id) => (
                    <>
                      <FormLabel htmlFor={id} required>
                        Billing project
                      </FormLabel>
                      <VirtualizedSelect
                        id={id}
                        isClearable={false}
                        placeholder='Select a billing project'
                        value={namespace || null}
                        ariaLiveMessages={{ onFocus: onFocusAria, onChange: onChangeAria }}
                        onChange={(opt) => setNamespace(opt!.value)}
                        styles={{ option: (provided) => ({ ...provided, padding: 10 }) }}
                        options={_.map((project: BillingProject) => {
                          const { projectName, invalidBillingAccount, cloudPlatform } = project;
                          return {
                            'aria-label': `${
                              cloudProviderLabels[cloudPlatform]
                            } ${projectName}${ariaInvalidBillingAccountMsg(invalidBillingAccount)}`,
                            label: (
                              <TooltipTrigger content={invalidBillingAccount && invalidBillingAccountMsg} side='left'>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {(cloudPlatform === 'GCP' || cloudPlatform === 'AZURE') && (
                                    <CloudProviderIcon
                                      key={projectName}
                                      cloudProvider={cloudPlatform}
                                      style={{ marginRight: '0.5rem' }}
                                    />
                                  )}
                                  {projectName}
                                  {isAzureBillingProject(project) && project.region && (
                                    <div key={`region-${projectName}`} style={{ marginLeft: '0.25rem' }}>
                                      {`(${getRegionLabel(project.region)})`}
                                    </div>
                                  )}
                                  {isAzureBillingProject(project) && project.protectedData && (
                                    <Icon
                                      icon={protectedDataIcon}
                                      key={`protected-${projectName}`}
                                      size={18}
                                      style={{ marginLeft: '0.5rem' }}
                                      aria-label={protectedDataLabel}
                                    />
                                  )}
                                </div>
                              </TooltipTrigger>
                            ),
                            value: projectName,
                            isDisabled: invalidBillingAccount,
                          };
                        }, _.sortBy('projectName', billingProjects))}
                      />
                    </>
                  )}
                </IdContainer>
                {isGoogleBillingProject() && (
                  <IdContainer>
                    {(id) => (
                      <>
                        <FormLabel htmlFor={id}>
                          Bucket location
                          <InfoBox style={{ marginLeft: '0.25rem' }}>
                            A bucket location can only be set when creating a workspace. Once set, it cannot be changed.
                            A cloned workspace will automatically inherit the bucket location from the original
                            workspace but this may be changed at clone time.
                            <p>
                              By default, workflow and Cloud Environments will run in the same region as the workspace
                              bucket. Changing bucket or Cloud Environment locations from the defaults can lead to
                              network egress charges.
                            </p>
                            <Link
                              href='https://support.terra.bio/hc/en-us/articles/360058964552'
                              {...Utils.newTabLinkProps}
                            >
                              Read more about bucket locations
                            </Link>
                          </InfoBox>
                        </FormLabel>
                        <Select<string>
                          id={id}
                          value={bucketLocation}
                          onChange={(opt) => setBucketLocation(opt!.value)}
                          options={isAlphaRegionalityUser ? allRegions : availableBucketRegions}
                        />
                      </>
                    )}
                  </IdContainer>
                )}
                {!!selectedBillingProject && !!cloneWorkspace && (
                  <CloneEgressWarning
                    sourceWorkspace={cloneWorkspace}
                    sourceAzureWorkspaceRegion={sourceAzureWorkspaceRegion}
                    selectedBillingProject={selectedBillingProject}
                    selectedGcpBucketLocation={bucketLocation}
                    sourceGCPWorkspaceRegion={sourceGCPWorkspaceRegion}
                    sourceGCPWorkspaceRegionError={sourceGCPWorkspaceRegionError}
                  />
                )}
                <IdContainer>
                  {(id) => (
                    <>
                      <FormLabel htmlFor={id}>Description</FormLabel>
                      <TextArea
                        id={id}
                        style={{ height: 100 }}
                        placeholder='Enter a description'
                        value={description}
                        onChange={setDescription}
                      />
                    </>
                  )}
                </IdContainer>
                {isGoogleBillingProject() && (
                  <div style={{ margin: '1rem 0.25rem 0.25rem 0' }}>
                    <IdContainer>
                      {(id) => (
                        <>
                          <LabeledCheckbox
                            style={{ margin: '0rem 0.25rem 0.25rem 0rem' }}
                            checked={enhancedBucketLogging}
                            disabled={
                              !!requireEnhancedBucketLogging || groups.length > 0 || cloningGcpProtectedWorkspace
                            }
                            onChange={() => setEnhancedBucketLogging(!enhancedBucketLogging)}
                            aria-describedby={id}
                          >
                            {
                              // the LabeledCheckbox uses an id container, and wraps its children in a span with the id,
                              // and sets it 'aria-labelledby': id
                              /* eslint-disable jsx-a11y/label-has-associated-control */
                            }
                            <label style={{ ...Style.elements.sectionHeader }}>{`Enable ${_.toLower(
                              protectedDataLabel
                            )}`}</label>
                            {/* eslint-enable jsx-a11y/label-has-associated-control */}
                          </LabeledCheckbox>
                          <InfoBox style={{ marginLeft: '0.25rem', verticalAlign: 'middle' }}>
                            {protectedDataMessage}
                          </InfoBox>
                        </>
                      )}
                    </IdContainer>
                  </div>
                )}
                {isGoogleBillingProject() && (
                  <IdContainer>
                    {(id) => (
                      <>
                        <FormLabel htmlFor={id}>
                          Authorization domain (optional)
                          <InfoBox style={{ marginLeft: '0.25rem' }}>
                            An authorization domain can only be set when creating a workspace. Once set, it cannot be
                            changed. Any cloned workspace will automatically inherit the authorization domain(s) from
                            the original workspace and cannot be removed.
                            <Link
                              href='https://support.terra.bio/hc/en-us/articles/360026775691'
                              {...Utils.newTabLinkProps}
                            >
                              Read more about authorization domains
                            </Link>
                          </InfoBox>
                        </FormLabel>
                        <p style={{ marginTop: '.25rem' }}>Additional group management controls</p>
                        {!!existingGroups.length && (
                          <div style={{ marginBottom: '0.5rem', fontSize: 12 }}>
                            <div style={{ marginBottom: '0.2rem' }}>Inherited groups:</div>
                            {existingGroups.join(', ')}
                          </div>
                        )}
                        <Select<string, true>
                          id={id}
                          isClearable={false}
                          isMulti
                          placeholder='Select groups'
                          isDisabled={!allGroups || !billingProjects}
                          value={groups}
                          onChange={(data) => {
                            setGroups(_.map('value', data));
                            setEnhancedBucketLogging(!!requireEnhancedBucketLogging || data.length > 0);
                          }}
                          options={_.difference(_.uniq(_.map('groupName', allGroups)), existingGroups).sort()}
                        />
                      </>
                    )}
                  </IdContainer>
                )}
                {renderPolicyAndWorkspaceInfo()}
                {workflowImport && azureBillingProjectsExist && (
                  <div style={{ padding: '1.0rem', display: 'flex' }}>
                    <Icon icon='info-circle' size={16} style={{ marginRight: '0.5rem', color: colors.accent() }} />,
                    <div>
                      Importing directly into new Azure workspaces is not currently supported. To create a new workspace
                      with an Azure billing project, visit the main
                      <Link href={Nav.getLink('workspaces')}>Workspaces</Link>
                      page.
                    </div>
                  </div>
                )}
                {createError && <div style={{ marginTop: '1rem', color: colors.danger() }}>{createError}</div>}
              </>
            )}
          </Modal>
        ),
      ],
      () => (
        <NoBillingModal
          onDismiss={onDismiss}
          isCloning={!!cloneWorkspace}
          requireEnhancedBucketLogging={requireEnhancedBucketLogging}
        />
      )
    );
  }
);

interface NoBillingModalProps {
  onDismiss: () => void;
  isCloning?: boolean;
  requireEnhancedBucketLogging?: boolean;
}

const NoBillingModal = (props: NoBillingModalProps) => {
  const { isCloning, requireEnhancedBucketLogging, onDismiss } = props;

  const getNoApplicableBillingProjectsMessage = () => {
    if (isCloning) {
      return 'You do not have a billing project that is able to clone this workspace.';
    }
    if (requireEnhancedBucketLogging) {
      return 'You do not have access to a billing project that supports additional security monitoring.';
    }
    return 'You need a billing project to create a new workspace.';
  };

  return (
    <Modal
      title='Set Up Billing'
      onDismiss={onDismiss}
      okButton={<ButtonPrimary onClick={() => Nav.goToPath('billing')}>Go to Billing</ButtonPrimary>}
    >
      <div>
        <Icon icon='error-standard' size={16} style={{ marginRight: '0.5rem', color: colors.warning() }} />
        {getNoApplicableBillingProjectsMessage()}
      </div>
    </Modal>
  );
};

export default NewWorkspaceModal;
