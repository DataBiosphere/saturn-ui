const featurePreviewsConfig = [
  {
    id: 'data-table-versioning',
    title: 'Data Table Versioning',
    description: 'Enabling this feature will allow you to save uniquely named versions of data tables. These saved versions will appear in the Data tab and can be restored at any time.',
    groups: ['preview-data-versioning-and-provenance'],
    feedbackUrl: `mailto:dsp-sue@broadinstitute.org?subject=${encodeURIComponent('Feedback on data table versioning')}`
  },
  {
    id: 'data-table-provenance',
    title: 'Data Table Provenance',
    description: 'Enabling this feature will allow you to view information about the workflow that generated data table columns and files.',
    groups: ['preview-data-versioning-and-provenance'],
    feedbackUrl: `mailto:dsp-sue@broadinstitute.org?subject=${encodeURIComponent('Feedback on data table provenance')}`
  },
  {
    id: 'workspace-data-service',
    title: 'Workspace Data Service (WDS) on Azure',
    description: 'Enabling this feature will enable WDS-powered data tables.',
    groups: ['preview-wds-on-azure'],
    feedbackUrl: `mailto:dsp-analysis-journeys@broadinstitute.org?subject=${encodeURIComponent('Feedback on WDS UI')}`
  }
]

export default featurePreviewsConfig
