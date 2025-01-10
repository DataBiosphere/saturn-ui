import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { Cbas, CbasAjaxContract } from 'src/libs/ajax/workflows-app/Cbas';
import { AzureWorkspace, AzureWorkspaceInfo } from 'src/libs/ajax/workspaces/workspace-models';
import { AppProxyUrlStatus, workflowsAppStore, WorkflowsAppStoreState } from 'src/libs/state';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import ImportGithub, { ImportGithubProps } from 'src/workflows-app/components/ImportGithub';

jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/workflows-app/Cbas');

jest.mock('src/libs/notifications');
jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  goToPath: jest.fn(),
}));
jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({}),
}));
jest.mock('src/libs/state', () => ({
  ...jest.requireActual('src/libs/state'),
  getTerraUser: jest.fn(),
}));

type UseMetricsExports = typeof import('src/libs/ajax/metrics/useMetrics');
jest.mock(
  'src/libs/ajax/metrics/useMetrics',
  (): UseMetricsExports => ({
    ...jest.requireActual<UseMetricsExports>('src/libs/ajax/metrics/useMetrics'),
    useMetricsEvent: jest.fn(() => ({ captureEvent: jest.fn() })),
  })
);

describe('Add a Workflow Link', () => {
  const workspace = partial<AzureWorkspace>({
    workspace: partial<AzureWorkspaceInfo>({
      namespace: 'test',
      name: 'test',
      cloudPlatform: 'Azure',
      workspaceId: '79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
    }),
  });

  const defaultImportGithubProps = (): ImportGithubProps => ({
    workspace,
    namespace: 'MyNamespace',
    setLoading: jest.fn(),
    name: 'MyName',
    setSelectedSubHeader: jest.fn(),
  });

  const postMethodFunction: MockedFn<CbasAjaxContract['methods']['post']> = jest.fn(async (_root, _payload) => ({
    method_id: 'abc123',
  }));

  asMockedFn(Cbas).mockReturnValue(
    partial<CbasAjaxContract>({
      methods: partial<CbasAjaxContract['methods']>({ post: postMethodFunction }),
    })
  );

  it('should render text inputs/headers', async () => {
    // ** ACT **
    render(
      h(ImportGithub, {
        workspace,
        namespace: 'MyNamespace',
        setLoading: jest.fn(),
        name: 'MyName',
        setSelectedSubHeader: jest.fn(),
      })
    );

    const urlLink = screen.getByText('Workflow Link *');
    const workflowName = screen.getByText('Workflow Name *');
    const addToWorkspaceButton = screen.getByText('Add to Workspace');

    expect(urlLink).toBeInTheDocument();
    expect(workflowName).toBeInTheDocument();
    expect(addToWorkspaceButton).toBeInTheDocument();
  });

  it('should submit github.com links for a running Workflows app', async () => {
    const githubLink =
      'https://github.com/broadinstitute/cromwell/blob/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl';
    const user = userEvent.setup();

    workflowsAppStore.set(
      partial<WorkflowsAppStoreState>({
        workspaceId: '79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
        cbasProxyUrlState: { status: AppProxyUrlStatus.Ready, state: 'https://lz-abc/terra-app-abc/cbas' },
      })
    );

    // ** ACT **
    render(h(ImportGithub, { ...defaultImportGithubProps() }));

    const urlLink = screen.getByPlaceholderText('Paste Github link');
    const workflowName = screen.getByPlaceholderText('Workflow Name');
    const addToWorkspaceButtonDisabled = screen.getByLabelText('Add to Workspace button');

    expect(addToWorkspaceButtonDisabled.getAttribute('aria-disabled')).toBe('true');

    fireEvent.change(urlLink, { target: { value: githubLink } });
    expect((workflowName as HTMLInputElement).value).toBe('simple_task');
    const addToWorkspaceButtonEnabled = screen.getByLabelText('Add to Workspace button');
    expect(addToWorkspaceButtonEnabled.getAttribute('aria-disabled')).toBe('false');
    await user.click(addToWorkspaceButtonEnabled);

    // ** ASSERT **
    // assert POST /methods endpoint was called with expected parameters & transformed github.com link
    expect(postMethodFunction).toHaveBeenCalledTimes(1);
    expect(postMethodFunction).toHaveBeenCalledWith('https://lz-abc/terra-app-abc/cbas', {
      method_name: 'simple_task',
      method_description: undefined,
      method_source: 'GitHub',
      method_version: 'develop',
      method_url: githubLink,
    });
  });

  it('should accept raw github.com links for a running Workflows app', async () => {
    const rawGithubLink =
      'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl';
    const user = userEvent.setup();

    workflowsAppStore.set(
      partial<WorkflowsAppStoreState>({
        workspaceId: '79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
        cbasProxyUrlState: { status: AppProxyUrlStatus.Ready, state: 'https://lz-abc/terra-app-abc/cbas' },
      })
    );

    // ** ACT **
    render(h(ImportGithub, { ...defaultImportGithubProps() }));

    const urlLink = screen.getByPlaceholderText('Paste Github link');
    const workflowName = screen.getByPlaceholderText('Workflow Name');

    fireEvent.change(urlLink, { target: { value: rawGithubLink } });
    // Expect autofill
    expect((workflowName as HTMLInputElement).value).toBe('simple_task');
    // User change name
    await user.clear(workflowName);
    fireEvent.change(workflowName, { target: { value: 'Test workflow again' } });
    const addToWorkspaceButtonEnabled = screen.getByLabelText('Add to Workspace button');
    await user.click(addToWorkspaceButtonEnabled);

    // Check that raw github links still work
    expect(postMethodFunction).toHaveBeenCalledTimes(1);
    expect(postMethodFunction).toHaveBeenCalledWith('https://lz-abc/terra-app-abc/cbas', {
      method_name: 'Test workflow again',
      method_description: undefined,
      method_source: 'GitHub',
      method_version: 'develop',
      method_url: rawGithubLink,
    });
  });

  it('should fail when given a non github link', async () => {
    // ** ACT **
    render(h(ImportGithub, { ...defaultImportGithubProps() }));

    const urlLink = screen.getByPlaceholderText('Paste Github link');
    const workflowName = screen.getByPlaceholderText('Workflow Name');
    const addToWorkspaceButton = screen.getByLabelText('Add to Workspace button');

    fireEvent.change(urlLink, { target: { value: 'lol.com' } });
    fireEvent.change(workflowName, { target: { value: 'Test bad workflow' } });

    expect(addToWorkspaceButton.getAttribute('aria-disabled')).toBe('true');
  });

  it('should not be able to import workflow if CBAS proxy url is not ready', async () => {
    // ** ARRANGE **
    const user = userEvent.setup();

    workflowsAppStore.set(
      partial<WorkflowsAppStoreState>({
        workspaceId: '79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
        cbasProxyUrlState: { status: AppProxyUrlStatus.None, state: '' },
      })
    );

    // ** ACT **
    render(h(ImportGithub, { ...defaultImportGithubProps() }));

    const urlLink = screen.getByPlaceholderText('Paste Github link');

    fireEvent.change(urlLink, {
      target: {
        value:
          'https://github.com/broadinstitute/cromwell/blob/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
      },
    });
    const addToWorkspaceButtonEnabled = screen.getByLabelText('Add to Workspace button');
    expect(addToWorkspaceButtonEnabled.getAttribute('aria-disabled')).toBe('false');
    await user.click(addToWorkspaceButtonEnabled);

    // ** ASSERT **
    expect(postMethodFunction).toHaveBeenCalledTimes(0);
  });

  it('shows modal on successful import', async () => {
    // Arrange
    const githubLink =
      'https://github.com/broadinstitute/cromwell/blob/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl';
    const user = userEvent.setup();

    workflowsAppStore.set(
      partial<WorkflowsAppStoreState>({
        workspaceId: '79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
        cbasProxyUrlState: { status: AppProxyUrlStatus.Ready, state: 'https://lz-abc/terra-app-abc/cbas' },
      })
    );

    // ** ACT **
    render(h(ImportGithub, { ...defaultImportGithubProps() }));

    const urlLink = screen.getByPlaceholderText('Paste Github link');
    const workflowName = screen.getByPlaceholderText('Workflow Name');

    fireEvent.change(urlLink, { target: { value: githubLink } });
    // Expect autofill
    expect((workflowName as HTMLInputElement).value).toBe('simple_task');

    const addToWorkspaceButtonEnabled = screen.getByLabelText('Add to Workspace button');
    await user.click(addToWorkspaceButtonEnabled);

    expect(postMethodFunction).toHaveBeenCalledTimes(1);

    // Expect modal to be on the screen when import is submitted
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
