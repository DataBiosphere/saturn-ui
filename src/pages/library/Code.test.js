import { act, screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { Dockstore } from 'src/libs/ajax/Dockstore';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { Code } from 'src/pages/library/Code';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/Dockstore');
jest.mock('src/libs/ajax/firecloud/FirecloudBucket');
jest.mock('src/libs/ajax/methods/Methods');

jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn().mockImplementation((_) => _),
}));

describe('Code page', () => {
  it('loads the code page', async () => {
    const methodsList = [
      {
        name: 'joint-discovery-gatk4',
        createDate: '2018-11-30T22:19:35Z',
        url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/gatk/joint-discovery-gatk4/1',
        synopsis: 'Implements the joint discovery and VQSR filtering',
        entityType: 'Workflow',
        snapshotComment: '',
        snapshotId: 1,
        namespace: 'gatk',
      },
    ];

    const featuredMethodsList = [
      {
        namespace: 'gatk',
        name: 'joint-discovery-gatk4',
      },
    ];

    FirecloudBucket.mockReturnValue({
      getFeaturedMethods: jest.fn(() => Promise.resolve(featuredMethodsList)),
    });
    Methods.mockReturnValue({
      list: jest.fn(() => Promise.resolve(methodsList)),
    });
    Dockstore.mockReturnValue({
      listTools: jest.fn(),
    });

    // Act
    await act(async () => {
      render(h(Code, {}));
    });

    // Assert
    const codeAndWorkflows = await screen.getByRole('link', { name: 'code & workflows' });
    expect(codeAndWorkflows).toHaveAttribute('href', 'library-code');

    const workflowName = await screen.getByRole('link', { name: 'joint-discovery-gatk4 Implements the joint discovery and VQSR filtering' });
    expect(workflowName.getAttribute('href')).toContain('?return=terra#methods/gatk/joint-discovery-gatk4/');
  });
});
