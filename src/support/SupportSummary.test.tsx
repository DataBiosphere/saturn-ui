import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { FullyQualifiedResourceId } from 'src/libs/ajax/SamResources';
import { reportError } from 'src/libs/error';
import { ResourceTypeSummaryProps } from 'src/support/SupportResourceType';
import { SupportSummary } from 'src/support/SupportSummary';
import { v4 as uuidv4 } from 'uuid';

type ErrorExports = typeof import('src/libs/error');
jest.mock(
  'src/libs/error',
  (): ErrorExports => ({
    ...jest.requireActual('src/libs/error'),
    reportError: jest.fn(),
  })
);

describe('SupportSummary', () => {
  it('calls loadSupportSummaryFn and displays the result', async () => {
    // Arrange
    const testValue = uuidv4();
    const loadSupportSummary = jest.fn(() => Promise.resolve({ supportSummary: testValue }));
    const fqResourceId: FullyQualifiedResourceId = { resourceId: 'resource-id', resourceTypeName: 'resource-type' };
    const props: ResourceTypeSummaryProps = {
      displayName: 'display-name',
      fqResourceId,
      loadSupportSummaryFn: loadSupportSummary,
    };

    // Act
    await act(async () => {
      render(<SupportSummary {...props} />);
    });

    // Assert
    expect(loadSupportSummary).toHaveBeenCalledWith(props.fqResourceId);
    expect(screen.getByText('display-name Summary')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(testValue, 'i'))).toBeInTheDocument();
  });

  it('displays an error message when loadSupportSummary throws an error', async () => {
    // Arrange
    const errorMessage = 'test error message';
    const loadSupportSummary = jest.fn(() => Promise.reject(new Error(errorMessage)));
    const fqResourceId: FullyQualifiedResourceId = { resourceId: 'resource-id', resourceTypeName: 'resource-type' };
    const props: ResourceTypeSummaryProps = {
      displayName: 'display-name',
      fqResourceId,
      loadSupportSummaryFn: loadSupportSummary,
    };

    // Act
    await act(async () => {
      render(<SupportSummary {...props} />);
    });

    // Assert
    expect(loadSupportSummary).toHaveBeenCalledWith(props.fqResourceId);
    expect(reportError).toHaveBeenCalled();
  });

  it('displays an error message when loadSupportSummary throws 404', async () => {
    // Arrange
    const loadSupportSummary = jest.fn(() => Promise.reject(new Response('', { status: 404 })));
    const fqResourceId: FullyQualifiedResourceId = { resourceId: 'resource-id', resourceTypeName: 'resource-type' };
    const props: ResourceTypeSummaryProps = {
      displayName: 'display-name',
      fqResourceId,
      loadSupportSummaryFn: loadSupportSummary,
    };

    // Act
    await act(async () => {
      render(<SupportSummary {...props} />);
    });

    // Assert
    expect(loadSupportSummary).toHaveBeenCalledWith(props.fqResourceId);
    expect(screen.getByText('display-name not found')).toBeInTheDocument();
  });

  it('displays an error message when loadSupportSummary throws 403', async () => {
    // Arrange
    const loadSupportSummary = jest.fn(() => Promise.reject(new Response('', { status: 403 })));
    const fqResourceId: FullyQualifiedResourceId = { resourceId: 'resource-id', resourceTypeName: 'resource-type' };
    const props: ResourceTypeSummaryProps = {
      displayName: 'display-name',
      fqResourceId,
      loadSupportSummaryFn: loadSupportSummary,
    };

    // Act
    await act(async () => {
      render(<SupportSummary {...props} />);
    });

    // Assert
    expect(loadSupportSummary).toHaveBeenCalledWith(props.fqResourceId);
    expect(
      screen.getByText('You do not have permission to view display-name summary information or are not on VPN')
    ).toBeInTheDocument();
  });
});
