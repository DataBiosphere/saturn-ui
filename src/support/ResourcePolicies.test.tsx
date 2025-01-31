import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { SamResources, SamResourcesContract } from 'src/libs/ajax/SamResources';
import { FullyQualifiedResourceId } from 'src/libs/ajax/SamResources';
import { reportError } from 'src/libs/error';
import { ResourcePolicies } from 'src/support/ResourcePolicies';
import { ResourceTypeSummaryProps } from 'src/support/SupportResourceType';
import { v4 as uuidv4 } from 'uuid';

jest.mock('src/libs/ajax/SamResources');

type ErrorExports = typeof import('src/libs/error');
jest.mock(
  'src/libs/error',
  (): ErrorExports => ({
    ...jest.requireActual('src/libs/error'),
    reportError: jest.fn(),
  })
);

describe('ResourcePolicies', () => {
  function setGetResourcePoliciesMock(getResourcePolicies: jest.Mock<Promise<Awaited<object>>, []>) {
    asMockedFn(SamResources).mockReturnValue(partial<SamResourcesContract>({ getResourcePolicies }));
  }

  it('calls SamResources().getResourcePolicies and displays the result', async () => {
    // Arrange
    const testValue = uuidv4();
    const getResourcePolicies = jest.fn(() => Promise.resolve({ policy: testValue }));
    setGetResourcePoliciesMock(getResourcePolicies);
    const fqResourceId: FullyQualifiedResourceId = { resourceId: 'resource-id', resourceTypeName: 'resource-type' };
    const props: ResourceTypeSummaryProps = {
      displayName: 'display-name',
      fqResourceId,
      loadSupportSummaryFn: undefined,
    };

    // Act
    await act(async () => {
      render(<ResourcePolicies {...props} />);
    });

    // Assert
    expect(getResourcePolicies).toHaveBeenCalledWith(fqResourceId);
    expect(screen.getByText('Sam Policies')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(testValue, 'i'))).toBeInTheDocument();
  });

  it('displays an error message when getResourcePolicies throws an error', async () => {
    // Arrange
    const errorMessage = 'test error message';
    const getResourcePolicies = jest.fn(() => Promise.reject(new Error(errorMessage)));
    setGetResourcePoliciesMock(getResourcePolicies);
    const fqResourceId: FullyQualifiedResourceId = { resourceId: 'resource-id', resourceTypeName: 'resource-type' };
    const props: ResourceTypeSummaryProps = {
      displayName: 'display-name',
      fqResourceId,
      loadSupportSummaryFn: undefined,
    };

    // Act
    await act(async () => {
      render(<ResourcePolicies {...props} />);
    });

    // Assert
    expect(getResourcePolicies).toHaveBeenCalledWith(fqResourceId);
    expect(reportError).toHaveBeenCalled();
  });

  it('displays an error message when getResourcePolicies returns an empty array', async () => {
    // Arrange
    const getResourcePolicies = jest.fn(() => Promise.resolve([]));
    setGetResourcePoliciesMock(getResourcePolicies);
    const fqResourceId: FullyQualifiedResourceId = { resourceId: 'resource-id', resourceTypeName: 'resource-type' };
    const props: ResourceTypeSummaryProps = {
      displayName: 'display-name',
      fqResourceId,
      loadSupportSummaryFn: undefined,
    };

    // Act
    await act(async () => {
      render(<ResourcePolicies {...props} />);
    });

    // Assert
    expect(getResourcePolicies).toHaveBeenCalledWith(fqResourceId);
    expect(screen.getByText('No policies found')).toBeInTheDocument();
  });

  it('displays an error message when getResourcePolicies throws 403', async () => {
    // Arrange
    const getResourcePolicies = jest.fn(() => Promise.reject(new Response('', { status: 403 })));
    setGetResourcePoliciesMock(getResourcePolicies);
    const fqResourceId: FullyQualifiedResourceId = { resourceId: 'resource-id', resourceTypeName: 'resource-type' };
    const props: ResourceTypeSummaryProps = {
      displayName: 'display-name',
      fqResourceId,
      loadSupportSummaryFn: undefined,
    };

    // Act
    await act(async () => {
      render(<ResourcePolicies {...props} />);
    });

    // Assert
    expect(getResourcePolicies).toHaveBeenCalledWith(fqResourceId);
    expect(
      screen.getByText('You do not have permission to view display-name policies or are not on VPN')
    ).toBeInTheDocument();
  });
});
