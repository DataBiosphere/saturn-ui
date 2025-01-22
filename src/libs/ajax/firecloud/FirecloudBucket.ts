import { fetchOk } from 'src/libs/ajax/fetch/fetch-core';
import { getConfig } from 'src/libs/config';

export const FirecloudBucket = (signal?: AbortSignal) => ({
  getServiceAlerts: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/alerts.json`, { signal });
    return res.json();
  },

  getFeaturedWorkspaces: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/featured-workspaces.json`, { signal });
    return res.json();
  },

  getShowcaseWorkspaces: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/showcase.json`, { signal });
    return res.json();
  },

  getTemplateWorkspaces: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/template-workspaces.json`, { signal });
    return res.json();
  },

  getBadVersions: async () => {
    const res = await fetchOk(`${getConfig().firecloudBucketRoot}/bad-versions.txt`, { signal });
    return res.text();
  },
});

export type FirecloudBucketAjaxContract = ReturnType<typeof FirecloudBucket>;
