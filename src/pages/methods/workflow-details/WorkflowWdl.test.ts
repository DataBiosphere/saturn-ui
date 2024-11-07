import { screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { snapshotStore } from 'src/libs/state';
import { BaseWorkflowWdl } from 'src/pages/methods/workflow-details/WorkflowWdl';
import { renderWithAppContexts } from 'src/testing/test-utils';

jest.mock('src/libs/ajax');

jest.mock('src/libs/notifications');

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual('src/libs/nav'),
    getLink: jest.fn(),
    goToPath: jest.fn(),
  })
);

jest.mock('react-virtualized', () => {
  const actual = jest.requireActual('react-virtualized');

  const { AutoSizer } = actual;

  class MockAutoSizer extends AutoSizer {
    state = {
      height: 1000,
      width: 1000,
    };

    setState = () => {};
  }

  return {
    ...actual,
    AutoSizer: MockAutoSizer,
  };
});

describe('WorkflowWdl Component', () => {
  const mockPayload = 'I am a mock wdl payload';

  beforeEach(() => {
    jest.spyOn(snapshotStore, 'get').mockImplementation(
      jest.fn().mockReturnValue({
        name: 'cnv_somatic_pair_workflow',
        snapshotId: 1,
        payload: mockPayload,
      })
    );
  });

  it('renders a simple smoke test for the WorkflowWdl component', () => {
    // ** ACT **
    renderWithAppContexts(h(BaseWorkflowWdl));

    // ** ASSERT **
    expect(screen.getByText('I am a mock wdl payload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download .wdl' }));
  });
});
