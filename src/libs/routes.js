import _ from 'lodash/fp';
import { compile, pathToRegexp } from 'path-to-regexp';
import * as Analysis from 'src/analysis/Analyses';
import * as AnalysisLauncher from 'src/analysis/AnalysisLauncher';
import * as AppLauncher from 'src/analysis/AppLauncher';
import * as DataBrowserDetails from 'src/data-catalog/DataBrowserDetails';
import * as DataBrowserPreview from 'src/data-catalog/DataBrowserPreview';
import * as ImportDataPage from 'src/import-data/ImportDataPage';
import { routeHandlersStore } from 'src/libs/state';
import * as AzurePreview from 'src/pages/AzurePreview';
import * as Projects from 'src/pages/billing/List/List';
import * as Environments from 'src/pages/EnvironmentsPage';
import * as FeaturePreviews from 'src/pages/FeaturePreviews';
import * as Group from 'src/pages/groups/Group';
import * as Groups from 'src/pages/groups/List';
import * as ImportWorkflow from 'src/pages/ImportWorkflow/ImportWorkflow';
import * as LandingPage from 'src/pages/LandingPage';
import * as Code from 'src/pages/library/Code';
import * as CreateDataset from 'src/pages/library/data-catalog/create-dataset/CreateDataset';
import * as DatasetBuilder from 'src/pages/library/datasetBuilder/DatasetBuilder';
import * as DatasetBuilderDetails from 'src/pages/library/datasetBuilder/DatasetBuilderDetails';
import * as Datasets from 'src/pages/library/Datasets';
import * as DataExplorer from 'src/pages/library/datasets/DataExplorer';
import * as Showcase from 'src/pages/library/Showcase';
import * as NotFound from 'src/pages/NotFound';
import * as PrivacyPolicy from 'src/pages/PrivacyPolicy';
import * as Profile from 'src/pages/Profile';
import * as TermsOfService from 'src/pages/TermsOfService';
import * as UploadData from 'src/pages/UploadDataPage';
import * as WorkflowsList from 'src/pages/workflows/List';
import * as WorkflowDetails from 'src/pages/workflows/workflow/WorkflowDetails';
import * as WorkspaceList from 'src/pages/workspaces/List';
import * as WorkspaceMigration from 'src/pages/workspaces/migration/WorkspaceMigration';
import * as Dashboard from 'src/pages/workspaces/workspace/Dashboard/Dashboard';
import * as WorkspaceFiles from 'src/pages/workspaces/workspace/Files';
import * as JobHistory from 'src/pages/workspaces/workspace/JobHistory';
import * as SubmissionDetails from 'src/pages/workspaces/workspace/jobHistory/SubmissionDetails';
import * as WorkflowDashboard from 'src/pages/workspaces/workspace/jobHistory/WorkflowDashboard';
import * as Workflows from 'src/pages/workspaces/workspace/Workflows';
import * as WorkflowView from 'src/pages/workspaces/workspace/workflows/WorkflowView';
import * as WorkflowsApp from 'src/workflows-app/routes';
import * as Data from 'src/workspace-data/Data';

/*
 * NOTE: In order to show up in reports, new events[^1] MUST be marked as expected in the Mixpanel
 * lexicon. See the Mixpanel guide in the terra-ui GitHub Wiki for more details:
 *   https://github.com/DataBiosphere/terra-ui/wiki/Mixpanel
 *
 * [^1] including page:view:* events for new pages; see PageViewReporter
 */
const routes = _.flatten([
  LandingPage.navPaths,
  WorkspaceList.navPaths,
  WorkflowView.navPaths,
  ImportDataPage.navPaths,
  ImportWorkflow.navPaths,
  PrivacyPolicy.navPaths,
  Dashboard.navPaths,
  Data.navPaths,
  Analysis.navPaths,
  JobHistory.navPaths,
  SubmissionDetails.navPaths,
  WorkflowDashboard.navPaths,
  Workflows.navPaths,
  AnalysisLauncher.navPaths,
  Profile.navPaths,
  Groups.navPaths,
  Group.navPaths,
  AppLauncher.navPaths,
  TermsOfService.navPaths,
  Code.navPaths,
  DataBrowserDetails.navPaths,
  DataBrowserPreview.navPaths,
  DatasetBuilder.navPaths,
  DatasetBuilderDetails.navPaths,
  CreateDataset.navPaths,
  DataExplorer.navPaths,
  Datasets.navPaths,
  Showcase.navPaths,
  Projects.navPaths,
  Environments.navPaths,
  WorkflowsList.navPaths,
  WorkflowDetails.navPaths,
  UploadData.navPaths,
  FeaturePreviews.navPaths,
  WorkspaceFiles.navPaths,
  AzurePreview.navPaths,
  WorkflowsApp.navPaths,
  WorkspaceMigration.navPaths,
  NotFound.navPaths, // must be last
]);

const handlers = _.map(({ path, encode = encodeURIComponent, ...data }) => {
  const keys = []; // mutated by pathToRegexp
  const regex = pathToRegexp(path, keys);
  return {
    regex,
    keys: _.map('name', keys),
    makePath: compile(path, { encode }),
    ...data,
  };
}, routes);

// NOTE: This is treated as stateful in order to support hot loading.
// Updates will re-execute this file, which will reset the routes.
routeHandlersStore.set(handlers);
