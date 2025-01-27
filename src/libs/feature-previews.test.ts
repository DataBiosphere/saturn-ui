import { CurrentUserGroupMembership, Groups, GroupsContract } from 'src/libs/ajax/Groups';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { getConfig } from 'src/libs/config';
import Events from 'src/libs/events';
import { getAvailableFeaturePreviews, isFeaturePreviewEnabled, toggleFeaturePreview } from 'src/libs/feature-previews';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import { asMockedFn, MockedFn, partial } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/Groups');
jest.mock('src/libs/ajax/Metrics');

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({}),
}));
jest.mock('src/libs/feature-previews-config', () => ({
  __esModule: true,
  default: [
    {
      id: 'feature1',
      title: 'Feature #1',
      description: 'A new feature',
    },
    {
      id: 'feature2',
      title: 'Feature #2',
      description: 'Another new feature',
      groups: ['preview-group'],
    },
  ],
}));
jest.mock('src/libs/prefs');

beforeEach(() => {
  asMockedFn(getConfig).mockReturnValue({ isProd: true });
});

describe('isFeaturePreviewEnabled', () => {
  it('reads from local preference', () => {
    // Arrange
    asMockedFn(getLocalPref).mockReturnValue(true);

    // Act
    const result = isFeaturePreviewEnabled('test-feature');

    // Assert
    expect(result).toBe(true);
    expect(getLocalPref).toHaveBeenCalledWith('feature-preview/test-feature');
  });
});

describe('toggleFeaturePreview', () => {
  it('sets local preference', () => {
    // Arrange
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: jest.fn() }));

    // Act
    toggleFeaturePreview('test-feature', false);

    // Assert
    expect(setLocalPref).toHaveBeenCalledWith('feature-preview/test-feature', false);
  });

  it('captures metrics', () => {
    // Arrange
    const captureEvent: MockedFn<MetricsContract['captureEvent']> = jest.fn();
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    // Act
    toggleFeaturePreview('test-feature', true);

    // Assert
    expect(captureEvent).toHaveBeenCalledWith(Events.featurePreviewToggle, {
      featureId: 'test-feature',
      enabled: true,
    });
  });
});

describe('getAvailableFeaturePreviews', () => {
  it("should return available feature previews based on user's groups", async () => {
    // Arrange
    asMockedFn(getLocalPref).mockReturnValue(false);

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: jest.fn(async () => []),
      })
    );

    // Act
    const result1 = await getAvailableFeaturePreviews();

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: jest.fn(async () => [
          partial<CurrentUserGroupMembership>({
            groupName: 'preview-group',
            groupEmail: 'preview-group@test.firecloud.org',
            role: 'member',
          }),
        ]),
      })
    );

    const result2 = await getAvailableFeaturePreviews();

    // Assert
    expect(result1).toEqual([
      {
        id: 'feature1',
        title: 'Feature #1',
        description: 'A new feature',
      },
    ]);
    expect(result2).toEqual([
      {
        id: 'feature1',
        title: 'Feature #1',
        description: 'A new feature',
      },
      {
        id: 'feature2',
        title: 'Feature #2',
        description: 'Another new feature',
        groups: ['preview-group'],
      },
    ]);
  });

  it('should include enabled feature previews regardless of group', async () => {
    // Arrange
    asMockedFn(getLocalPref).mockImplementation((key) => key === 'feature-preview/feature2');

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: jest.fn(async () => []),
      })
    );

    // Act
    const result = await getAvailableFeaturePreviews();

    // Assert
    expect(result).toEqual([
      {
        id: 'feature1',
        title: 'Feature #1',
        description: 'A new feature',
      },
      {
        id: 'feature2',
        title: 'Feature #2',
        description: 'Another new feature',
        groups: ['preview-group'],
      },
    ]);
  });

  it('should include all feature previews in non-production environments', async () => {
    // Arrange
    asMockedFn(getConfig).mockReturnValue({ isProd: false });
    asMockedFn(getLocalPref).mockReturnValue(false);

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: jest.fn(async () => []),
      })
    );

    // Act
    const result = await getAvailableFeaturePreviews();

    // Assert
    expect(result).toEqual([
      {
        id: 'feature1',
        title: 'Feature #1',
        description: 'A new feature',
      },
      {
        id: 'feature2',
        title: 'Feature #2',
        description: 'Another new feature',
        groups: ['preview-group'],
      },
    ]);
  });
});
