import { asMockedFn, partial, withFakeTimers } from '@terra-ui-packages/test-utils';
import { act, renderHook } from '@testing-library/react';
import { FirecloudBucket, FirecloudBucketAjaxContract } from 'src/libs/ajax/firecloud/FirecloudBucket';

import { getBadVersions, useTimeUntilRequiredUpdate, useVersionAlerts, versionStore } from './version-alerts';

jest.mock('src/libs/ajax/firecloud/FirecloudBucket');

describe('useVersionAlerts', () => {
  it('returns an empty list if current version and latest version match', () => {
    // Arrange
    versionStore.set({
      currentVersion: 'abcd123',
      latestVersion: 'abcd123',
      updateRequiredBy: undefined,
    });

    // Act
    const { result: hookReturnRef } = renderHook(() => useVersionAlerts());

    // Assert
    expect(hookReturnRef.current).toEqual([]);
  });

  it('returns an alert if current version and latest version do not match', () => {
    // Arrange
    versionStore.set({
      currentVersion: 'abcd123',
      latestVersion: '1234567',
      updateRequiredBy: undefined,
    });

    // Act
    const { result: hookReturnRef } = renderHook(() => useVersionAlerts());

    // Assert
    expect(hookReturnRef.current).toContainEqual(
      expect.objectContaining({
        id: 'update-available',
        title: 'Update available',
      })
    );
  });
});

describe('getBadVersions', () => {
  it.each([
    { responseText: '# broken\nabcd123 \neeee456\n\n', expectedVersions: ['abcd123', 'eeee456'] },
    { responseText: 'abcd123', expectedVersions: ['abcd123'] },
    { responseText: '', expectedVersions: [] },
    { responseText: '\n  \n', expectedVersions: [] },
  ] as {
    responseText: string;
    expectedVersions: string[];
  }[])('parses list of bad versions from firecloud-alerts bucket', async ({ responseText, expectedVersions }) => {
    // Arrange
    const ajaxGetBadVersions = jest.fn().mockResolvedValue(responseText);
    asMockedFn(FirecloudBucket).mockReturnValue(
      partial<FirecloudBucketAjaxContract>({ getBadVersions: ajaxGetBadVersions })
    );

    // Act
    const badVersions = await getBadVersions();

    // Assert
    expect(ajaxGetBadVersions).toHaveBeenCalled();
    expect(badVersions).toEqual(expectedVersions);
  });

  it('returns empty list if bad versions file does not exist', async () => {
    // Arrange
    const ajaxGetBadVersions = jest.fn().mockRejectedValue(new Response('Not found', { status: 404 }));
    asMockedFn(FirecloudBucket).mockReturnValue(
      partial<FirecloudBucketAjaxContract>({ getBadVersions: ajaxGetBadVersions })
    );

    // Act
    const badVersions = await getBadVersions();

    // Assert
    expect(badVersions).toEqual([]);
  });
});

describe('useTimeUntilRequiredUpdate', () => {
  const originalLocation = window.location;

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: jest.fn() },
    });
  });

  afterAll(() => {
    window.location = originalLocation;
  });

  it('returns undefined if no update is required', () => {
    // Arrange
    versionStore.set({
      currentVersion: 'abcd123',
      latestVersion: 'abcd123',
      updateRequiredBy: undefined,
    });

    // Act
    const { result: hookReturnRef } = renderHook(() => useTimeUntilRequiredUpdate());

    // Assert
    expect(hookReturnRef.current).toBeUndefined();
  });

  it(
    'rerenders when version store is updated',
    withFakeTimers(() => {
      // Arrange
      versionStore.set({
        currentVersion: 'abcd123',
        latestVersion: '1234567',
        updateRequiredBy: undefined,
      });

      const initialTime = 1706504400000;
      jest.setSystemTime(initialTime);

      const { result: hookReturnRef } = renderHook(() => useTimeUntilRequiredUpdate());

      // Act
      const updateIntervalInSeconds = 300;
      act(() => {
        versionStore.set({
          currentVersion: 'abcd123',
          latestVersion: '1234567',
          updateRequiredBy: initialTime + updateIntervalInSeconds * 1000,
        });
      });

      // Assert
      expect(hookReturnRef.current).toBe(updateIntervalInSeconds);
    })
  );

  it(
    'returns time until required update',
    withFakeTimers(() => {
      // Arrange
      const initialTime = 1706504400000;
      const timeUntilUpdateInSeconds = 60;
      versionStore.set({
        currentVersion: 'abcd123',
        latestVersion: '1234567',
        updateRequiredBy: initialTime + timeUntilUpdateInSeconds * 1000,
      });

      jest.setSystemTime(initialTime);

      // Act
      const { result: hookReturnRef } = renderHook(() => useTimeUntilRequiredUpdate());

      // Assert
      expect(hookReturnRef.current).toBe(timeUntilUpdateInSeconds);

      // Act
      act(() => jest.advanceTimersByTime((timeUntilUpdateInSeconds / 2) * 1000));

      // Assert
      expect(hookReturnRef.current).toBe(timeUntilUpdateInSeconds / 2);
    })
  );

  it(
    'reloads browser when time until required update elapses',
    withFakeTimers(() => {
      // Arrange
      const initialTime = 1706504400000;
      const timeUntilUpdate = 60000;
      versionStore.set({
        currentVersion: 'abcd123',
        latestVersion: '1234567',
        updateRequiredBy: initialTime + timeUntilUpdate,
      });

      jest.setSystemTime(initialTime);

      // Act
      renderHook(() => useTimeUntilRequiredUpdate());
      act(() => jest.advanceTimersByTime(timeUntilUpdate));

      // Assert
      expect(window.location.reload).toHaveBeenCalled();
    })
  );
});
