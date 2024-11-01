import { fireEvent, screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { snapshotStore } from 'src/libs/state';
import { BaseWorkflowSummary } from 'src/pages/workflows/workflow/WorkflowSummary';
import { renderWithAppContexts } from 'src/testing/test-utils';

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

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({ orchestrationUrlRoot: 'afirecloudurlroot' }),
}));

describe('WorkflowSummary Component', () => {
  it('renders all headers for workflow info', () => {
    // ** ARRANGE **
    jest.spyOn(snapshotStore, 'get').mockImplementation(
      jest.fn().mockReturnValue({
        namespace: 'nameFoo',
        name: 'cnv_somatic_pair_workflow',
        snapshotId: 1,
        createDate: '2017-10-20T20:07:22Z',
        managers: ['nameFoo@fooname.com'],
        synopsis: 'a very fancy method',
        documentation: '',
        public: true,
        snapshotComment: 'a fake snapshot',
      })
    );

    // ** ACT **
    renderWithAppContexts(h(BaseWorkflowSummary));

    // ** ASSERT **
    expect(screen.getByText('Synopsis')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('Snapshot Information')).toBeInTheDocument();
    expect(screen.getByText('Owners')).toBeInTheDocument();
    expect(screen.getByText('Import URL')).toBeInTheDocument();
  });

  it('has snapshot information collapsable open on render', () => {
    // ** ARRANGE **
    jest.spyOn(snapshotStore, 'get').mockImplementation(
      jest.fn().mockReturnValue({
        namespace: 'nameFoo',
        name: 'cnv_somatic_pair_workflow',
        snapshotId: 1,
        createDate: '2017-10-20T20:07:22Z',
        managers: ['nameFoo@fooname.com'],
        synopsis: 'a very fancy method',
        documentation: '',
        public: true,
        snapshotComment: 'a fake snapshot',
      })
    );

    // ** ACT **
    renderWithAppContexts(h(BaseWorkflowSummary));

    // ** ASSERT **
    const snapshotInfoCollapsable = screen.getByRole('button', { name: 'Snapshot Information' });
    expect(snapshotInfoCollapsable).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByText('Creation Date'));
    expect(screen.getByText('10/20/2017'));
    expect(screen.getByText('Publicly Readable'));
    expect(screen.getByText('Public'));
    expect(screen.getByText('Snapshot Comment'));
    // Using queryAllBy here because of the comment and tooltip containing the same text
    expect(screen.queryAllByText('a fake snapshot'));
  });

  it('shows Private for private methods', () => {
    // ** ARRANGE **
    jest.spyOn(snapshotStore, 'get').mockImplementation(
      jest.fn().mockReturnValue({
        namespace: 'nameFoo',
        name: 'cnv_somatic_pair_workflow',
        snapshotId: 1,
        createDate: '2017-10-20T20:07:22Z',
        managers: ['nameFoo@fooname.com'],
        synopsis: 'a very fancy method',
        documentation: '',
        public: false,
        snapshotComment: 'a fake snapshot',
      })
    );

    // ** ACT **
    renderWithAppContexts(h(BaseWorkflowSummary));

    // ** ASSERT **
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.queryByText('Public')).not.toBeInTheDocument();
  });

  it('does not show Synopsis header when one is not present', () => {
    // ** ARRANGE **
    jest.spyOn(snapshotStore, 'get').mockImplementation(
      jest.fn().mockReturnValue({
        namespace: 'nameFoo',
        name: 'cnv_somatic_pair_workflow',
        snapshotId: 1,
        createDate: '2017-10-20T20:07:22Z',
        managers: ['nameFoo@fooname.com'],
        synopsis: '',
        documentation: '',
        public: false,
        snapshotComment: 'a fake snapshot',
      })
    );

    // ** ACT **
    renderWithAppContexts(h(BaseWorkflowSummary));

    // ** ASSERT **
    expect(screen.queryByText('Synopsis')).not.toBeInTheDocument();
  });

  it('shows expected method information when collapsable is open', () => {
    // ** ARRANGE **
    jest.spyOn(snapshotStore, 'get').mockImplementation(
      jest.fn().mockReturnValue({
        namespace: 'nameFoo',
        name: 'cnv_somatic_pair_workflow',
        snapshotId: 1,
        createDate: '2017-10-20T20:07:22Z',
        managers: ['nameFoo@fooname.com', 'fooName@namefoo.com'],
        synopsis: '',
        documentation: '',
        public: false,
        snapshotComment: 'a fake snapshot',
      })
    );

    // ** ACT **
    renderWithAppContexts(h(BaseWorkflowSummary));

    // ** ASSERT **
    const ownersCollapsable = screen.getByRole('button', { name: 'Owners' });
    const importUrlCollapsable = screen.getByRole('button', { name: 'Import URL' });

    // Expect collapsable to be closed on render
    expect(ownersCollapsable).toHaveAttribute('aria-expanded', 'false');
    expect(importUrlCollapsable).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(ownersCollapsable);
    fireEvent.click(importUrlCollapsable);

    // Expect collapsable to be expanded after clicking
    expect(ownersCollapsable).toHaveAttribute('aria-expanded', 'true');
    expect(importUrlCollapsable).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByText('nameFoo@fooname.com'));
    expect(screen.getByText('fooName@namefoo.com'));

    expect(
      screen.getByText(
        'afirecloudurlroot/ga4gh/v1/tools/nameFoo:cnv_somatic_pair_workflow/versions/1/plain-WDL/descriptor'
      )
    );
  });
});
