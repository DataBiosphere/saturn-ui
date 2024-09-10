import * as qs from 'qs';
import { fetchGoogleForms } from 'src/libs/ajax/ajax-common';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { Billing } from 'src/libs/ajax/Billing';
import { Catalog } from 'src/libs/ajax/Catalog';
import { DataRepo } from 'src/libs/ajax/DataRepo';
import { Dockstore } from 'src/libs/ajax/Dockstore';
import { DrsUriResolver } from 'src/libs/ajax/drs/DrsUriResolver';
import { ExternalCredentials } from 'src/libs/ajax/ExternalCredentials';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { Groups } from 'src/libs/ajax/Groups';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { Disks } from 'src/libs/ajax/leonardo/Disks';
import { Runtimes } from 'src/libs/ajax/leonardo/Runtimes';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { Metrics } from 'src/libs/ajax/Metrics';
import { OAuth2 } from 'src/libs/ajax/OAuth2';
import { SamResources } from 'src/libs/ajax/SamResources';
import { Submissions } from 'src/libs/ajax/submissions/Submissions';
import { Support } from 'src/libs/ajax/Support';
import { TermsOfService } from 'src/libs/ajax/TermsOfService';
import { User } from 'src/libs/ajax/User';
import { Cbas } from 'src/libs/ajax/workflows-app/Cbas';
import { CromIAM } from 'src/libs/ajax/workflows-app/CromIAM';
import { CromwellApp } from 'src/libs/ajax/workflows-app/CromwellApp';
import { WorkflowScript } from 'src/libs/ajax/workflows-app/WorkflowScript';
import { WorkspaceData } from 'src/libs/ajax/WorkspaceDataService';
import { WorkspaceManagerResources } from 'src/libs/ajax/WorkspaceManagerResources';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';

const Surveys = (signal?: AbortSignal) => ({
  submitForm: (formId, data) => fetchGoogleForms(`${formId}/formResponse?${qs.stringify(data)}`, { signal }),
});

export const Ajax = (signal?: AbortSignal) => {
  return {
    Apps: Apps(signal),
    AzureStorage: AzureStorage(signal),
    Billing: Billing(signal),
    Buckets: GoogleStorage(signal),
    Catalog: Catalog(signal),
    Cbas: Cbas(signal),
    CromIAM: CromIAM(signal),
    CromwellApp: CromwellApp(signal),
    DataRepo: DataRepo(signal),
    Disks: Disks(signal),
    Dockstore: Dockstore(signal),
    DrsUriResolver: DrsUriResolver(signal),
    ExternalCredentials: ExternalCredentials(signal),
    FirecloudBucket: FirecloudBucket(signal),
    Groups: Groups(signal),
    Methods: Methods(signal),
    Metrics: Metrics(signal),
    OAuth2: OAuth2(signal),
    Runtimes: Runtimes(signal),
    SamResources: SamResources(signal),
    Submissions: Submissions(signal),
    Support: Support(signal),
    Surveys: Surveys(signal),
    TermsOfService: TermsOfService(signal),
    User: User(signal),
    WorkflowScript: WorkflowScript(signal),
    WorkspaceData: WorkspaceData(signal),
    WorkspaceManagerResources: WorkspaceManagerResources(signal),
    Workspaces: Workspaces(signal),
  };
};

export type AjaxContract = ReturnType<typeof Ajax>;

// Exposing Ajax for use by integration tests (and debugging, or whatever)
(window as any).Ajax = Ajax;
