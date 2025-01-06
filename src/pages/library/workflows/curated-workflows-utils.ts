export interface CuratedWorkflowDetails {
  key: string; // used as a key for list items
  title: string;
  url: string;
}

export const curatedWorkflowsList = (dockstoreUrlRoot: string): Array<CuratedWorkflowDetails> => {
  return [
    {
      key: 'gatk',
      title: 'GATK Best Practices',
      url: `${dockstoreUrlRoot}/organizations/BroadInstitute/collections/GATKWorkflows`,
    },
    {
      key: 'longRead',
      title: 'Long Read Pipelines',
      url: `${dockstoreUrlRoot}/organizations/BroadInstitute/collections/LongReadPipelines`,
    },
    {
      key: 'warp',
      title: 'WDL Analysis Research Pipelines',
      url: `${dockstoreUrlRoot}/organizations/BroadInstitute/collections/WARPpipelines`,
    },
    {
      key: 'vg',
      title: 'Viral Genomics',
      url: `${dockstoreUrlRoot}/organizations/BroadInstitute/collections/pgs`,
    },
  ];
};
