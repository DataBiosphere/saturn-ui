import { SpinnerOverlay } from '@terra-ui-packages/components';
import { withHandlers } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import * as qs from 'qs';
import React, { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import * as Auth from 'src/auth/auth';
import { CreateBillingProjectControl } from 'src/billing/List/CreateBillingProjectControl';
import { GCPNewBillingProjectModal } from 'src/billing/List/GCPNewBillingProjectModal';
import { ProjectListItem, ProjectListItemProps } from 'src/billing/List/ProjectListItem';
import { AzureBillingProjectWizard } from 'src/billing/NewBillingProjectWizard/AzureBillingProjectWizard/AzureBillingProjectWizard';
import { GCPBillingProjectWizard } from 'src/billing/NewBillingProjectWizard/GCPBillingProjectWizard/GCPBillingProjectWizard';
import ProjectDetail from 'src/billing/Project';
import { isCreating, isDeleting } from 'src/billing/utils';
import { billingRoles } from 'src/billing/utils';
import { BillingProject, GoogleBillingAccount } from 'src/billing-core/models';
import Collapse from 'src/components/Collapse';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import { reportErrorAndRethrow } from 'src/libs/error';
import Events from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { useWorkspaces } from 'src/workspaces/common/state/useWorkspaces';
import { CloudProvider, cloudProviderTypes, WorkspaceWrapper } from 'src/workspaces/utils';

const BillingProjectSubheader: React.FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <Collapse
    title={<span style={{ fontWeight: 'bold' }}>{title}</span>}
    initialOpenState
    titleFirst
    summaryStyle={{ padding: '1rem 1rem 1rem 2rem' }}
  >
    {children}
  </Collapse>
);

interface RightHandContentProps {
  selectedName: string | undefined;
  billingProjects: BillingProject[];
  billingAccounts: Record<string, GoogleBillingAccount>;
  isLoadingProjects: boolean;
  showAzureBillingProjectWizard: boolean;
  projectsOwned: BillingProject[];
  allWorkspaces: WorkspaceWrapper[];
  refreshWorkspaces: () => Promise<void>;
  loadProjects: () => void;
  authorizeAndLoadAccounts: () => Promise<void>;
  setCreatingBillingProjectType: (type: CloudProvider | null) => void;
  reloadBillingProject: (billingProject: BillingProject) => Promise<unknown>;
  shouldRedirectToBilling: boolean;
}

// This is the view of the Billing Project details, or the wizard to create a new billing project.
const RightHandContent = (props: RightHandContentProps): ReactNode => {
  const {
    selectedName,
    billingProjects,
    billingAccounts,
    isLoadingProjects,
    showAzureBillingProjectWizard,
    projectsOwned,
    allWorkspaces,
    refreshWorkspaces,
    loadProjects,
    authorizeAndLoadAccounts,
    setCreatingBillingProjectType,
    reloadBillingProject,
    shouldRedirectToBilling,
  } = props;
  if (!!selectedName && !_.some({ projectName: selectedName }, billingProjects)) {
    shouldRedirectToBilling && Nav.goToPath('billing'); // Redirect to billing page if redirect flag is set

    return (
      <div style={{ margin: '1rem auto 0 auto' }}>
        <div>
          <h2>Error loading selected billing project.</h2>
          <p>It may not exist, or you may not have access to it.</p>
        </div>
      </div>
    );
  }
  if (showAzureBillingProjectWizard) {
    return (
      <AzureBillingProjectWizard
        onSuccess={(billingProjectName, protectedData) => {
          Ajax().Metrics.captureEvent(Events.billingCreationBillingProjectCreated, {
            billingProjectName,
            cloudPlatform: cloudProviderTypes.AZURE,
            protectedData,
          });
          setCreatingBillingProjectType(null);
          loadProjects();
        }}
      />
    );
  }
  if (!isLoadingProjects && _.isEmpty(billingProjects) && !Auth.isAzureUser()) {
    return (
      <GCPBillingProjectWizard
        billingAccounts={billingAccounts}
        authorizeAndLoadAccounts={authorizeAndLoadAccounts}
        onSuccess={(billingProjectName) => {
          Ajax().Metrics.captureEvent(Events.billingCreationBillingProjectCreated, {
            billingProjectName,
            cloudPlatform: cloudProviderTypes.GCP,
          });
          setCreatingBillingProjectType(null);
          loadProjects();
          Nav.history.push({
            pathname: Nav.getPath('billing'),
            search: qs.stringify({ selectedName: billingProjectName, type: 'project' }),
          });
        }}
      />
    );
  }
  if (!!selectedName && _.some({ projectName: selectedName }, billingProjects)) {
    const billingProject = billingProjects.find(({ projectName }) => projectName === selectedName);
    return (
      <ProjectDetail
        key={selectedName}
        // We know from the condition that the billingProject does exist.
        // @ts-ignore
        billingProject={billingProject}
        billingAccounts={billingAccounts}
        authorizeAndLoadAccounts={authorizeAndLoadAccounts}
        // We know from the condition that the billingProject does exist.
        // @ts-ignore
        reloadBillingProject={() => reloadBillingProject(billingProject).catch(loadProjects)}
        isOwner={projectsOwned.some(({ projectName }) => projectName === selectedName)}
        workspaces={allWorkspaces}
        refreshWorkspaces={refreshWorkspaces}
      />
    );
  }
  if (!_.isEmpty(projectsOwned) && !selectedName) {
    return <div style={{ margin: '1rem auto 0 auto' } as CSSProperties}>Select a Billing Project</div>;
  }
};

interface BillingListProps {
  queryParams: {
    selectedName: string | undefined;
  };
}

export const BillingList = (props: BillingListProps) => {
  // State
  const [billingProjects, setBillingProjects] = useState<BillingProject[]>(StateHistory.get().billingProjects || []);
  const [creatingBillingProjectType, setCreatingBillingProjectType] = useState<CloudProvider | null>();
  const [billingAccounts, setBillingAccounts] = useState<Record<string, GoogleBillingAccount>>({});
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
  const { workspaces: allWorkspaces, loading: workspacesLoading, refresh: refreshWorkspaces } = useWorkspaces();
  const [shouldRedirectToBilling, setShouldRedirectToBilling] = useState<boolean>(false);

  const signal = useCancellation();
  const interval = useRef<number>();
  const selectedName = props.queryParams.selectedName;
  const billingProjectListWidth = 350;

  // Helpers
  const loadProjects = _.flow(
    reportErrorAndRethrow('Error loading billing projects list'),
    Utils.withBusyState(setIsLoadingProjects)
  )(async () => setBillingProjects(_.sortBy('projectName', await Ajax(signal).Billing.listProjects())));

  const reloadBillingProject = _.flow(
    reportErrorAndRethrow('Error loading billing project'),
    Utils.withBusyState(setIsLoadingProjects)
  )(async ({ projectName }) => {
    const index = _.findIndex({ projectName }, billingProjects);
    // fetch the project to error if it doesn't exist/user can't access
    // The component that calls this function is only rendered when selectedName is non-null.
    try {
      const project = await Ajax(signal).Billing.getProject(selectedName!);
      setBillingProjects(_.set([index], project));
    } catch (error: Error | any) {
      // Remove project if user doesn't have access or project doesn't exist then set redirect flag
      if (error.status === 403 || error.status === 404) {
        setBillingProjects(billingProjects.filter((bp) => bp.projectName !== projectName));
        setShouldRedirectToBilling(true);
      }
      // Rethrow the error so reportErrorAndRethrow still works as expected
      throw error;
    }
  });

  const authorizeAccounts = _.flow(
    reportErrorAndRethrow('Error setting up authorization'),
    Utils.withBusyState(setIsAuthorizing)
  )(Auth.ensureBillingScope);

  const tryAuthorizeAccounts = _.flow(
    reportErrorAndRethrow('Error setting up authorization'),
    Utils.withBusyState(setIsAuthorizing)
  )(Auth.tryBillingScope);

  const loadAccounts = withHandlers(
    [reportErrorAndRethrow('Error loading billing accounts'), Utils.withBusyState(setIsLoadingAccounts)],
    async () => {
      if (Auth.hasBillingScope()) {
        void (await Ajax(signal)
          .Billing.listAccounts()
          .then(_.keyBy('accountName')) // @ts-ignore
          .then(setBillingAccounts));
      }
    }
  );

  const authorizeAndLoadAccounts = () => authorizeAccounts().then(loadAccounts);

  const showCreateProjectModal = async (type: CloudProvider) => {
    if (type === 'AZURE') {
      setCreatingBillingProjectType(type);
      // Show the Azure wizard instead of the selected billing project.
      Nav.history.replace({ search: '' });
    } else if (Auth.hasBillingScope()) {
      setCreatingBillingProjectType(type);
    } else {
      await authorizeAndLoadAccounts();
      Auth.hasBillingScope() && setCreatingBillingProjectType(type);
    }
  };

  // Lifecycle
  useOnMount(() => {
    loadProjects();
    tryAuthorizeAccounts().then(loadAccounts);
  });

  useEffect(() => {
    const projectsCreatingOrDeleting = _.some((project) => isCreating(project) || isDeleting(project), billingProjects);

    if (projectsCreatingOrDeleting && !interval.current) {
      interval.current = window.setInterval(loadProjects, 30000);
    } else if (!projectsCreatingOrDeleting && interval.current) {
      clearInterval(interval.current);
      interval.current = undefined;
    }

    StateHistory.update({ billingProjects });

    return () => {
      clearInterval(interval.current);
      interval.current = undefined;
    };
  });

  // Render
  const [projectsOwned, projectsShared] = _.partition(
    ({ roles }) => _.includes(billingRoles.owner, roles),
    billingProjects
  );

  const azureUserWithNoBillingProjects = !isLoadingProjects && _.isEmpty(billingProjects) && Auth.isAzureUser();
  const creatingAzureBillingProject = !selectedName && creatingBillingProjectType === 'AZURE';

  const makeProjectListItemProps = (project: BillingProject): ProjectListItemProps => {
    return {
      project,
      isActive: !!selectedName && project.projectName === selectedName,
      billingProjectActionsProps: { allWorkspaces, workspacesLoading, loadProjects, projectName: project.projectName },
    };
  };

  return (
    <div role='main' style={{ display: 'flex', flex: 1, height: `calc(100% - ${Style.topBarHeight}px)` }}>
      <div
        style={{
          minWidth: billingProjectListWidth,
          maxWidth: billingProjectListWidth,
          boxShadow: '0 2px 5px 0 rgba(0,0,0,0.25)',
          overflowY: 'auto',
        }}
      >
        <div
          role='navigation'
          style={{
            fontSize: 16,
            fontWeight: 600,
            padding: '2rem 1rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textTransform: 'uppercase',
            color: colors.dark(),
          }}
        >
          <h2 style={{ fontSize: 16 }}>Billing Projects</h2>
          <CreateBillingProjectControl showCreateProjectModal={showCreateProjectModal} />
        </div>
        <BillingProjectSubheader title='Owned by You'>
          <div role='list'>
            {projectsOwned.map((project) => (
              <ProjectListItem key={project.projectName} {...makeProjectListItemProps(project)} />
            ))}
          </div>
        </BillingProjectSubheader>
        <BillingProjectSubheader title='Shared with You'>
          <div role='list'>
            {projectsShared.map((project) => (
              <ProjectListItem key={project.projectName} {...makeProjectListItemProps(project)} />
            ))}
          </div>
        </BillingProjectSubheader>
        {creatingBillingProjectType === 'GCP' && (
          <GCPNewBillingProjectModal
            billingAccounts={billingAccounts}
            loadAccounts={loadAccounts}
            onDismiss={() => setCreatingBillingProjectType(null)}
            onSuccess={(billingProjectName) => {
              Ajax().Metrics.captureEvent(Events.billingCreationBillingProjectCreated, {
                billingProjectName,
                cloudPlatform: cloudProviderTypes.GCP,
              });
              setCreatingBillingProjectType(null);
              loadProjects();
            }}
          />
        )}
      </div>
      <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <RightHandContent
          authorizeAndLoadAccounts={authorizeAndLoadAccounts}
          billingAccounts={billingAccounts}
          billingProjects={billingProjects}
          isLoadingProjects={isLoadingProjects}
          loadProjects={loadProjects}
          projectsOwned={projectsOwned}
          allWorkspaces={allWorkspaces}
          refreshWorkspaces={refreshWorkspaces}
          selectedName={selectedName}
          showAzureBillingProjectWizard={azureUserWithNoBillingProjects || creatingAzureBillingProject}
          setCreatingBillingProjectType={setCreatingBillingProjectType}
          reloadBillingProject={reloadBillingProject}
          shouldRedirectToBilling={shouldRedirectToBilling}
        />
      </div>
      {(isLoadingProjects || isAuthorizing || isLoadingAccounts) && <SpinnerOverlay mode='FullScreen' />}
    </div>
  );
};
