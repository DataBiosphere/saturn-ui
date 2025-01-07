import { fetchOk } from 'src/libs/ajax/fetch/fetch-core';

import { fetchDockstore } from './ajax-common';

export type DockstoreWorkflowDescriptor = {
  path: string;
  isTool: boolean;
};

export type DockstoreWorkflowVersionDescriptor = DockstoreWorkflowDescriptor & {
  version: string;
};

export type DockstoreWorkflowVersion = {
  'descriptor-type': unknown[];
  dockerfile: boolean;
  id: string;
  image: string;
  'meta-version': string;
  name: string;
  url: string;
  verified: boolean;
  'verified-source': string;
};

export type DockstoreWorkflow = {
  author: string;
  contains: unknown[];
  description: string;
  id: string;
  'meta-version': string;
  organization: string;
  signed: boolean;
  toolclass: {
    description: string;
    workflow: string;
    name: string;
  };
  toolname: string;
  url: string;
  verified: boolean;
  'verified-source': string;
  versions: DockstoreWorkflowVersion[];
};

// %23 = '#', %2F = '/'
const workflowVersionsPath = ({ path, isTool }: DockstoreWorkflowDescriptor) => {
  return `api/ga4gh/v1/tools/${isTool ? '' : '%23workflow%2F'}${encodeURIComponent(path)}/versions`;
};

export const Dockstore = (signal?: AbortSignal) => ({
  getWdl: async ({ path, version, isTool }: DockstoreWorkflowVersionDescriptor): Promise<string> => {
    const wdlPath = `${workflowVersionsPath({ path, isTool })}/${encodeURIComponent(version)}/WDL/descriptor`;
    const { url } = await fetchDockstore(wdlPath, { signal }).then((res) => res.json());
    return fetchOk(url, { signal }).then((res) => res.text());
  },

  getVersions: ({ path, isTool }: DockstoreWorkflowDescriptor): Promise<DockstoreWorkflowVersion[]> => {
    return fetchDockstore(workflowVersionsPath({ path, isTool }), { signal }).then((res) => res.json());
  },

  getWorkflowSourceUrl: async (path, version) => {
    const wdlPath = `${workflowVersionsPath({ path, isTool: false })}/${encodeURIComponent(version)}/WDL/descriptor`;
    const { url } = await fetchDockstore(wdlPath, { signal }).then((res) => res.json());
    return url;
  },
});

export type DockstoreContract = ReturnType<typeof Dockstore>;
