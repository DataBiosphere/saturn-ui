import { DeepPartial } from '@terra-ui-packages/core-utils';
import { waitFor } from '@testing-library/react';
import React from 'react';
import { GroupDetails } from 'src/groups/GroupDetails';
import { Ajax } from 'src/libs/ajax';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/nav', (): typeof import('src/libs/nav') => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn((link) => link),
}));

type ErrorExports = typeof import('src/libs/error');
const mockReportError = jest.fn();

jest.mock(
  'src/libs/error',
  (): ErrorExports => ({
    ...jest.requireActual('src/libs/error'),
    reportError: (...args) => mockReportError(...args),
  })
);

type AjaxContract = ReturnType<typeof Ajax>;
jest.mock('src/libs/ajax');

jest.mock('src/libs/state-history', (): typeof import('src/libs/state-history') => ({
  ...jest.requireActual('src/libs/state-history'),
  get: jest.fn().mockReturnValue({}),
  update: jest.fn(),
}));

describe('GroupDetails', () => {
  it('renders users in the group', async () => {
    // Arrange
    const userEmails = ['testUser@email.com'];
    const adminEmails = [];
    asMockedFn(Ajax).mockImplementation(
      () =>
        ({
          Groups: {
            group: () => ({
              listMembers: jest.fn().mockResolvedValue(userEmails),
              listAdmins: jest.fn().mockResolvedValue(adminEmails),
              getPolicy: jest.fn().mockResolvedValue(false),
            }),
          },
        } as DeepPartial<AjaxContract> as AjaxContract)
    );
    // Act
    const { getByText, queryByText } = render(<GroupDetails groupName='test-group-name' />);
    // Assert
    await waitFor(() => expect(getByText(userEmails[0])).toBeDefined());
    expect(getByText('member')).toBeDefined();
    expect(queryByText('admin')).toBeFalsy();
  });

  it('renders admins in the group', async () => {
    // Arrange
    const userEmails = [];
    const adminEmails = ['testAdmin@email.com'];
    asMockedFn(Ajax).mockImplementation(
      () =>
        ({
          Groups: {
            group: () => ({
              listMembers: jest.fn().mockResolvedValue(userEmails),
              listAdmins: jest.fn().mockResolvedValue(adminEmails),
              getPolicy: jest.fn().mockResolvedValue(false),
            }),
          },
        } as DeepPartial<AjaxContract> as AjaxContract)
    );
    // Act
    const { getByText, queryByText } = render(<GroupDetails groupName='test-group-name' />);
    // Assert
    await waitFor(() => expect(getByText(adminEmails[0])).toBeDefined());
    expect(getByText('admin')).toBeDefined();
    expect(queryByText('member')).toBeFalsy();
  });
});
