import { DeepPartial } from '@terra-ui-packages/core-utils';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { AnalysesData } from 'src/analysis/Analyses';
import { Cbas } from 'src/libs/ajax/workflows-app/Cbas';
import { asMockedFn } from 'src/testing/test-utils';
import { FeaturedWorkflows } from 'src/workflows-app/FeaturedWorkflows';
import { featuredWorkflowsData } from 'src/workflows-app/fixtures/featured-workflows';
import { mockAzureWorkspace } from 'src/workflows-app/utils/mock-responses';

const defaultAnalysesData: AnalysesData = {
  apps: [],
  refreshApps: jest.fn().mockReturnValue(Promise.resolve()),
  runtimes: [],
  refreshRuntimes: () => Promise.resolve(),
  appDataDisks: [],
  persistentDisks: [],
};

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({
    wdsUrlRoot: 'https://lz-abc/wds-abc-c07807929cd1/',
    cbasUrlRoot: 'https://lz-abc/terra-app-abc/cbas',
    cromwellUrlRoot: 'https://lz-abc/terra-app-abc/cromwell',
  }),
}));

jest.mock('src/libs/ajax/workflows-app/Cbas', () => ({
  Cbas: jest.fn(),
}));

jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  goToPath: jest.fn(),
}));

type CbasContract = ReturnType<typeof Cbas>;

describe('Featured workflows', () => {
  it('should render un-imported covid-19 workflows as a set to be imported', async () => {
    const user = userEvent.setup();

    const getWithVersions = jest.fn().mockReturnValue(Promise.resolve({ methods: [] }));
    const post = jest.fn().mockReturnValue(Promise.resolve());
    const mockMethods: DeepPartial<CbasContract> = {
      methods: {
        getWithVersions,
        post,
      },
    };
    asMockedFn(Cbas).mockImplementation(() => mockMethods as CbasContract);

    await act(() =>
      render(
        h(FeaturedWorkflows, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          analysesData: defaultAnalysesData,
        })
      )
    );

    expect(getWithVersions).toHaveBeenCalledTimes(1);

    expect(screen.getByText(/Featured workflows/i)).toBeInTheDocument();
    expect(screen.getByText(/Get up and running with these commonly used, standard workflows./i)).toBeInTheDocument();
    expect(screen.getByText(/Covid-19 tutorial workflows/i)).toBeInTheDocument();

    expect(screen.queryByText(/You already have some of the workflows in this set/i)).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Add to workspace' });
    await user.click(button);

    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenCalledWith(
      'https://lz-abc/terra-app-abc/cbas',
      expect.objectContaining({ method_name: 'fetch_sra_to_bam' })
    );
    expect(post).toHaveBeenCalledWith(
      'https://lz-abc/terra-app-abc/cbas',
      expect.objectContaining({ method_name: 'assemble_refbased' })
    );
    expect(post).toHaveBeenCalledWith(
      'https://lz-abc/terra-app-abc/cbas',
      expect.objectContaining({ method_name: 'sarscov2_nextstrain' })
    );
  });

  it('should render partially imported covid-19 workflows with a tooltip', async () => {
    const user = userEvent.setup();

    const getWithVersions = jest
      .fn()
      .mockReturnValue(Promise.resolve({ methods: featuredWorkflowsData[0].methods.slice(0, 1) }));
    const post = jest.fn().mockReturnValue(Promise.resolve());
    const mockMethods: DeepPartial<CbasContract> = {
      methods: {
        getWithVersions,
        post,
      },
    };
    asMockedFn(Cbas).mockImplementation(() => mockMethods as CbasContract);

    await act(() =>
      render(
        h(FeaturedWorkflows, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          analysesData: defaultAnalysesData,
        })
      )
    );

    expect(getWithVersions).toHaveBeenCalledTimes(1);

    expect(screen.getByText(/Featured workflows/i)).toBeInTheDocument();
    expect(screen.getByText(/Get up and running with these commonly used, standard workflows./i)).toBeInTheDocument();
    expect(screen.getByText(/Covid-19 tutorial workflows/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/You already have some of the workflows in this set/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Add to workspace' });
    await user.click(button);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith(
      'https://lz-abc/terra-app-abc/cbas',
      expect.objectContaining({ method_name: 'assemble_refbased' })
    );
    expect(post).toHaveBeenCalledWith(
      'https://lz-abc/terra-app-abc/cbas',
      expect.objectContaining({ method_name: 'sarscov2_nextstrain' })
    );
  });

  it('should render fully imported covid-19 workflows with added text', async () => {
    const user = userEvent.setup();

    const getWithVersions = jest.fn().mockReturnValue(Promise.resolve({ methods: featuredWorkflowsData[0].methods }));
    const post = jest.fn().mockReturnValue(Promise.resolve());
    const mockMethods: DeepPartial<CbasContract> = {
      methods: {
        getWithVersions,
        post,
      },
    };
    asMockedFn(Cbas).mockImplementation(() => mockMethods as CbasContract);

    await act(() =>
      render(
        h(FeaturedWorkflows, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          analysesData: defaultAnalysesData,
        })
      )
    );

    expect(getWithVersions).toHaveBeenCalledTimes(1);

    expect(screen.getByText(/Featured workflows/i)).toBeInTheDocument();
    expect(screen.getByText(/Get up and running with these commonly used, standard workflows./i)).toBeInTheDocument();
    expect(screen.getByText(/Covid-19 tutorial workflows/i)).toBeInTheDocument();

    expect(screen.queryByText(/You already have some of the workflows in this set/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to workspace' })).not.toBeInTheDocument();
    const added = screen.getByText(/Added/i);
    await user.click(added);

    expect(post).toHaveBeenCalledTimes(0);
  });
});
