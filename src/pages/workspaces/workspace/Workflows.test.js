import { screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { Metrics } from 'src/libs/ajax/Metrics';
import { goToPath } from 'src/libs/nav';
import { FindWorkflowModal } from 'src/pages/workspaces/workspace/Workflows';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/firecloud/FirecloudBucket');
jest.mock('src/libs/ajax/methods/Methods');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  getLink: jest.fn(),
  goToPath: jest.fn(),
}));

describe('Find Workflow Modal (GCP)', () => {
  let getFeaturedMethods;
  let getRuns;
  let loadMethod;
  let methodApi;
  let configurations;
  let toWorkspace;

  const namespace = 'testNamespace';
  const name = 'testName';
  const ws = {
    name,
    namespace,
    cloudPlatform: 'Gcp',
  };
  const onDismiss = jest.fn();
  const methodConfiguration = { inputs: {}, outputs: {}, snapshotId: 1, name: 'haplotypecaller-gvcf-gatk4', namespace: 'gatk' };

  beforeEach(() => {
    getFeaturedMethods = jest.fn(() =>
      Promise.resolve([
        {
          namespace: 'gatk',
          name: 'haplotypecaller-gvcf-gatk4',
        },
      ])
    );
    getRuns = jest.fn(({ _ }) =>
      Promise.resolve([
        {
          name: 'haplotypecaller-gvcf-gatk4',
          createDate: '2018-11-30T22:18:35Z',
          url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/gatk/haplotypecaller-gvcf-gatk4/1',
          synopsis: 'Runs HaplotypeCaller from GATK4 in GVCF mode on a single sample',
          entityType: 'Workflow',
          snapshotComment: '',
          snapshotId: 1,
          namespace: 'gatk',
        },
        {
          name: 'unfeatured-workflow',
          createDate: '2018-11-30T22:18:35Z',
          url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/gatk/unfeatured-workflow/1',
          synopsis: 'Not a featured workflow',
          entityType: 'Workflow',
          snapshotComment: '',
          snapshotId: 1,
          namespace: 'gatk',
        },
      ])
    );
    loadMethod = jest.fn(() => {
      Promise.resolve({
        managers: ['test@test.org'],
        name: 'haplotypecaller-gvcf-gatk4',
        createDate: '2018-11-30T22:18:35Z',
        documentation: 'Some workflow documentation',
        entityType: 'Workflow',
        snapshotComment: '',
        snapshotId: 1,
        namespace: 'gatk',
        payload: '## Some workflow content',
        url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/gatk/haplotypecaller-gvcf-gatk4/1',
        public: true,
        synopsis: 'Runs HaplotypeCaller from GATK4 in GVCF mode on a single sample',
      });
    });
    methodApi = () => ({
      get: loadMethod,
      configs: configurations,
      toWorkspace,
    });
    configurations = jest.fn(() => Promise.resolve([methodConfiguration]));
    toWorkspace = jest.fn(() => Promise.resolve());

    FirecloudBucket.mockReturnValue({ getFeaturedMethods });
    Methods.mockReturnValue({
      list: getRuns,
      method: methodApi,
    });
    Metrics.mockReturnValue({ captureEvent: jest.fn(() => {}) });
  });

  it('renders recommended workflows', async () => {
    // Arrange
    const props = { namespace, name, ws, onDismiss };

    // Act
    await act(async () => {
      render(h(FindWorkflowModal, props));
    });

    expect(getFeaturedMethods).toHaveBeenCalled();
    expect(getRuns).toHaveBeenCalled();

    expect(screen.queryByText('haplotypecaller-gvcf-gatk4')).toBeInTheDocument();
    expect(screen.queryByText('Runs HaplotypeCaller from GATK4 in GVCF mode on a single sample')).toBeInTheDocument();
    expect(screen.queryByText('unfeatured-workflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Not a featured workflow')).not.toBeInTheDocument();
  });

  it('supports importing recommended workflows', async () => {
    // Arrange
    const user = userEvent.setup();

    const props = { namespace, name, ws, onDismiss };

    // Act
    await act(async () => {
      render(h(FindWorkflowModal, props));
    });

    const workflowCardButton = screen.getAllByRole('button').filter((button) => button.textContent.includes('haplotypecaller-gvcf-gatk4'))[0];
    expect(workflowCardButton).toHaveTextContent('haplotypecaller-gvcf-gatk4');
    await user.click(workflowCardButton);

    const addButton = screen.getAllByRole('button').filter((button) => button.textContent.includes('Add to Workspace'))[0];
    await user.click(addButton);

    // Assert
    expect(toWorkspace).toHaveBeenCalledWith({ namespace, name }, methodConfiguration);
    expect(goToPath).toHaveBeenCalledWith('workflow', { namespace, name, workflowName: 'haplotypecaller-gvcf-gatk4', workflowNamespace: 'gatk' });
  });
});
