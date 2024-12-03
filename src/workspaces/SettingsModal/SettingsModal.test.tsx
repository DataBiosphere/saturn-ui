import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import _ from 'lodash/fp';
import React from 'react';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { SeparateSubmissionFinalOutputsSetting } from 'src/libs/ajax/workspaces/workspace-models';
import { Workspaces, WorkspacesAjaxContract, WorkspaceV2Contract } from 'src/libs/ajax/workspaces/Workspaces';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { GCP_BUCKET_LIFECYCLE_RULES } from 'src/libs/feature-previews-config';
import { asMockedFn, partial, renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';
import { defaultGoogleWorkspace, makeGoogleWorkspace } from 'src/testing/workspace-fixtures';
import SettingsModal from 'src/workspaces/SettingsModal/SettingsModal';
import {
  BucketLifecycleSetting,
  RequesterPaysSetting,
  secondsInADay,
  softDeleteDefaultRetention,
  SoftDeleteSetting,
  suggestedPrefixes,
  WorkspaceSetting,
} from 'src/workspaces/SettingsModal/utils';

jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

type FeaturePreviewsExports = typeof import('src/libs/feature-previews');
jest.mock('src/libs/feature-previews', (): FeaturePreviewsExports => {
  return {
    ...jest.requireActual<FeaturePreviewsExports>('src/libs/feature-previews'),
    isFeaturePreviewEnabled: jest.fn(),
  };
});

describe('SettingsModal', () => {
  const captureEvent = jest.fn();

  const fourDaysAllObjects: BucketLifecycleSetting = {
    config: {
      rules: [
        {
          action: {
            actionType: 'Delete',
          },
          conditions: {
            age: 4,
            matchesPrefix: [],
          },
        },
      ],
    },
    settingType: 'GcpBucketLifecycle',
  };

  const zeroDaysTwoPrefixes: BucketLifecycleSetting = {
    config: {
      rules: [
        {
          action: {
            actionType: 'Delete',
          },
          conditions: {
            age: 0,
            matchesPrefix: ['a/', 'b/'],
          },
        },
      ],
    },
    settingType: 'GcpBucketLifecycle',
  };

  const twoRules: BucketLifecycleSetting = {
    config: {
      rules: [
        {
          action: {
            actionType: 'Delete',
          },
          conditions: {
            age: 1,
            matchesPrefix: [],
          },
        },
        {
          action: {
            actionType: 'Delete',
          },
          conditions: {
            age: 2,
            matchesPrefix: ['p/'],
          },
        },
      ],
    },
    settingType: 'GcpBucketLifecycle',
  };

  const noLifecycleRules: BucketLifecycleSetting = { settingType: 'GcpBucketLifecycle', config: { rules: [] } };
  const defaultSoftDeleteSetting: SoftDeleteSetting = {
    settingType: 'GcpBucketSoftDelete',
    config: { retentionDurationInSeconds: softDeleteDefaultRetention },
  };

  const requesterPaysEnabledSetting: RequesterPaysSetting = {
    settingType: 'GcpBucketRequesterPays',
    config: { enabled: true },
  };

  const requesterPaysDisabledSetting: RequesterPaysSetting = {
    settingType: 'GcpBucketRequesterPays',
    config: { enabled: false },
  };

  const separateSubmissionOutputsDisabledSetting: SeparateSubmissionFinalOutputsSetting = {
    settingType: 'SeparateSubmissionFinalOutputs',
    config: { enabled: false },
  };

  const separateSubmissionOutputsEnabledSetting: SeparateSubmissionFinalOutputsSetting = {
    settingType: 'SeparateSubmissionFinalOutputs',
    config: { enabled: true },
  };

  const setup = (currentSetting: WorkspaceSetting[], updateSettingsMock: jest.Mock<any, any>) => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspaceV2: () =>
          partial<WorkspaceV2Contract>({
            getSettings: jest.fn().mockResolvedValue(currentSetting),
            updateSettings: updateSettingsMock,
          }),
      })
    );
    asMockedFn(isFeaturePreviewEnabled).mockImplementation((id) => id === GCP_BUCKET_LIFECYCLE_RULES);
  };

  it('has no accessibility errors', async () => {
    // Arrange
    setup([twoRules], jest.fn());

    // Act and Assert
    await act(async () => {
      const { container } = render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it('does not show bucket lifecycle settings if the feature flag is disabled', async () => {
    // Arrange
    setup([], jest.fn());
    asMockedFn(isFeaturePreviewEnabled).mockReturnValue(false);

    // Act
    await act(async () => {
      render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
    });

    // Assert
    expect(screen.queryByText('Lifecycle Rules:')).toBeNull();
  });

  it('calls onDismiss on Save and does not event if there are no changes (no initial workspace settings)', async () => {
    // Arrange
    const user = userEvent.setup();
    const updateSettingsMock = jest.fn();
    setup([], updateSettingsMock);
    const onDismiss = jest.fn();

    // Act
    await act(async () => {
      render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={onDismiss} />);
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(onDismiss).toHaveBeenCalled();
    expect(captureEvent).not.toHaveBeenCalled();
    // On save we do persist the default soft delete setting so it is now explicit.
    expect(updateSettingsMock).toHaveBeenCalledWith([defaultSoftDeleteSetting]);
  });

  it('calls onDismiss on Cancel and does not event', async () => {
    // Arrange
    const user = userEvent.setup();
    setup([], jest.fn());
    const onDismiss = jest.fn();

    // Act
    await act(async () => {
      render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={onDismiss} />);
    });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(onDismiss).toHaveBeenCalled();
    expect(captureEvent).not.toHaveBeenCalled();
  });

  it('disables Save if the user is not an owner', async () => {
    // Arrange
    setup([], jest.fn());
    const onDismiss = jest.fn();

    // Act
    await act(async () => {
      render(<SettingsModal workspace={makeGoogleWorkspace({ accessLevel: 'READER' })} onDismiss={onDismiss} />);
    });

    // Assert
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toHaveAttribute('aria-disabled', 'true');
    screen.getByText('You do not have permissions to modify settings');
  });

  describe('Bucket Lifecycle Settings', () => {
    const getToggle = () => screen.getByLabelText('Lifecycle Rules:');
    const getPrefixInput = (user): SelectHelper =>
      new SelectHelper(
        screen.getByLabelText('Specify if all objects should be deleted, or objects with specific prefixes'),
        user
      );
    const getDays = () => screen.getByLabelText('Days after creation:');

    it('renders all options as disabled if the user is not an owner', async () => {
      // Arrange
      const user = userEvent.setup();
      setup([twoRules], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={makeGoogleWorkspace({ accessLevel: 'READER' })} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getToggle()).toBeDisabled();
      expect(getDays()).toHaveAttribute('disabled');
      expect(getPrefixInput(user).inputElement).toHaveAttribute('disabled');
    });

    it('renders the option as off if no settings exist', async () => {
      // Arrange
      const user = userEvent.setup();
      setup([], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getToggle()).toHaveAttribute('aria-checked', 'false');

      const prefixInput = getPrefixInput(user);
      expect(prefixInput.getSelectedOptions()).toEqual([]);
      expect(prefixInput.inputElement).toHaveAttribute('disabled');

      const daysInput = getDays();
      expect(daysInput).toHaveValue(null);
      expect(daysInput).toHaveAttribute('disabled');
    });

    it('renders the option as on if all objects are being deleted', async () => {
      // Arrange
      const user = userEvent.setup();
      setup([fourDaysAllObjects], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getToggle()).toHaveAttribute('aria-checked', 'true');

      const prefixInput = getPrefixInput(user);
      expect(prefixInput.getSelectedOptions()).toEqual([suggestedPrefixes.allObjects]);
      expect(prefixInput.inputElement).not.toHaveAttribute('disabled');
      const allOptions = await prefixInput.getOptions();
      expect(allOptions).toEqual([
        suggestedPrefixes.submissionIntermediaries,
        suggestedPrefixes.submissionFinalOutputs,
        suggestedPrefixes.submissions,
      ]);

      const daysInput = getDays();
      expect(daysInput).toHaveValue(4);
      expect(daysInput).not.toHaveAttribute('disabled');
    });

    it('renders the option as on if certain prefixes are being disabled', async () => {
      // Arrange
      const user = userEvent.setup();
      setup([zeroDaysTwoPrefixes], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getToggle()).toHaveAttribute('aria-checked', 'true');

      const prefixInput = getPrefixInput(user);
      expect(prefixInput.getSelectedOptions()).toEqual(['a/', 'b/']);
      expect(prefixInput.inputElement).not.toHaveAttribute('disabled');
      const allOptions = await prefixInput.getOptions();
      expect(allOptions).toEqual(_.values(suggestedPrefixes));

      const daysInput = getDays();
      expect(daysInput).toHaveValue(0);
      expect(daysInput).not.toHaveAttribute('disabled');
    });

    it('uses the first GcpBucketLifecycle setting present', async () => {
      // Arrange
      const user = userEvent.setup();
      const enabledForAllObjects: WorkspaceSetting[] = [fourDaysAllObjects, zeroDaysTwoPrefixes];
      setup(enabledForAllObjects, jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getToggle()).toHaveAttribute('aria-checked', 'true');
      const prefixInput = getPrefixInput(user);
      expect(prefixInput.getSelectedOptions()).toEqual([suggestedPrefixes.allObjects]);
      expect(getDays()).toHaveValue(4);
    });

    it('uses the first set of rules present', async () => {
      // Arrange
      const user = userEvent.setup();
      setup([twoRules], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getToggle()).toHaveAttribute('aria-checked', 'true');
      const prefixInput = getPrefixInput(user);
      expect(prefixInput.getSelectedOptions()).toEqual([suggestedPrefixes.allObjects]);
      expect(getDays()).toHaveValue(1);
    });

    it('persists disabling single lifecycle rule', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([fourDaysAllObjects], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      // Options get cleared
      const prefixInput = getPrefixInput(user);
      expect(prefixInput.getSelectedOptions()).toEqual([]);
      expect(getDays()).toHaveValue(null);

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([
        defaultSoftDeleteSetting,
        separateSubmissionOutputsDisabledSetting,
        noLifecycleRules,
      ]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsBucketLifecycle, {
        enabled: false,
        prefix: null,
        age: null,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('removes first lifecycle rule if user disables it', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([twoRules], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      // Options get cleared
      const prefixInput = getPrefixInput(user);
      expect(prefixInput.getSelectedOptions()).toEqual([]);
      expect(getDays()).toHaveValue(null);

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([
        defaultSoftDeleteSetting,
        separateSubmissionOutputsDisabledSetting,
        {
          config: {
            rules: [
              {
                action: {
                  actionType: 'Delete',
                },
                conditions: {
                  age: 2,
                  matchesPrefix: ['p/'],
                },
              },
            ],
          },
          settingType: 'GcpBucketLifecycle',
        },
      ]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsBucketLifecycle, {
        enabled: false,
        prefix: null,
        age: null,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('modifies only the first rule', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([twoRules], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const daysInput = getDays();
      await user.clear(daysInput);
      await user.type(daysInput, '7');
      expect(daysInput).toHaveValue(7);

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([
        defaultSoftDeleteSetting,
        separateSubmissionOutputsEnabledSetting,
        {
          config: {
            rules: [
              {
                action: {
                  actionType: 'Delete',
                },
                conditions: {
                  age: 7,
                  matchesPrefix: [],
                },
              },
              {
                action: {
                  actionType: 'Delete',
                },
                conditions: {
                  age: 2,
                  matchesPrefix: ['p/'],
                },
              },
            ],
          },
          settingType: 'GcpBucketLifecycle',
        },
      ]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsBucketLifecycle, {
        enabled: true,
        prefix: 'AllObjects',
        age: 7,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('persists deleting all objects after 0 days', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([zeroDaysTwoPrefixes], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const prefixInput = getPrefixInput(user);
      await prefixInput.selectOption(suggestedPrefixes.allObjects);
      expect(prefixInput.getSelectedOptions()).toEqual([suggestedPrefixes.allObjects]);

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([
        defaultSoftDeleteSetting,
        separateSubmissionOutputsEnabledSetting,
        {
          config: {
            rules: [
              {
                action: {
                  actionType: 'Delete',
                },
                conditions: {
                  age: 0,
                  matchesPrefix: [],
                },
              },
            ],
          },
          settingType: 'GcpBucketLifecycle',
        },
      ]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsBucketLifecycle, {
        enabled: true,
        prefix: 'AllObjects',
        age: 0,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('persists changing prefixes and changing days', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([fourDaysAllObjects], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const prefixInput = getPrefixInput(user);
      await prefixInput.selectOption(suggestedPrefixes.submissions);
      await prefixInput.selectOption(suggestedPrefixes.submissionIntermediaries);
      expect(prefixInput.getSelectedOptions()).toEqual([
        suggestedPrefixes.submissions,
        suggestedPrefixes.submissionIntermediaries,
      ]);

      const daysInput = getDays();
      await user.clear(daysInput);
      await user.type(daysInput, '14');
      expect(daysInput).toHaveValue(14);

      const saveButton = screen.getByRole('button', { name: 'Save' });
      expect(saveButton).toHaveAttribute('aria-disabled', 'false');
      expect(screen.queryByText('Please specify all lifecycle rule options')).toBeNull();
      await user.click(saveButton);

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([
        defaultSoftDeleteSetting,
        separateSubmissionOutputsEnabledSetting,
        {
          config: {
            rules: [
              {
                action: {
                  actionType: 'Delete',
                },
                conditions: {
                  age: 14,
                  matchesPrefix: [suggestedPrefixes.submissions, suggestedPrefixes.submissionIntermediaries],
                },
              },
            ],
          },
          settingType: 'GcpBucketLifecycle',
        },
      ]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsBucketLifecycle, {
        enabled: true,
        prefix: 'AllSubmissionsAndSubmissionsIntermediaries',
        age: 14,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('disables Save if there is no date value specified', async () => {
      // Arrange
      const user = userEvent.setup();
      setup([fourDaysAllObjects], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const daysInput = getDays();
      await user.clear(daysInput);
      expect(daysInput).toHaveValue(null);

      // Assert
      const saveButton = screen.getByRole('button', { name: 'Save' });
      expect(saveButton).toHaveAttribute('aria-disabled', 'true');
      screen.getByText('Please specify all lifecycle rule options');
    });
  });

  describe('Soft Delete Settings', () => {
    const getSoftDeleteToggle = () => screen.getByLabelText('Soft Delete:');
    const getRetention = () => screen.getByLabelText('Days to retain:');

    it('renders all options as disabled if the user is not an owner', async () => {
      // Arrange
      setup([], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={makeGoogleWorkspace({ accessLevel: 'READER' })} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getSoftDeleteToggle()).toBeDisabled();
      expect(getRetention()).toHaveAttribute('disabled');
    });

    it('renders the option as "on" with default retention if no setting exists', async () => {
      // Arrange
      setup([], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getSoftDeleteToggle()).toBeChecked();
      expect(getRetention()).toHaveValue(softDeleteDefaultRetention / secondsInADay);
    });

    it('disables Save if there is no retention value specified', async () => {
      // Arrange
      const user = userEvent.setup();
      setup([], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const daysInput = getRetention();
      await user.clear(daysInput);
      expect(daysInput).toHaveValue(null);

      // Assert
      const saveButton = screen.getByRole('button', { name: 'Save' });
      expect(saveButton).toHaveAttribute('aria-disabled', 'true');
      screen.getByText('Please specify a soft delete retention value');
    });

    it('supports changing the retention period', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([defaultSoftDeleteSetting], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const daysInput = getRetention();
      await user.clear(daysInput);
      await user.type(daysInput, '80');
      expect(daysInput).toHaveValue(80);

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([
        {
          settingType: 'GcpBucketSoftDelete',
          config: { retentionDurationInSeconds: 80 * secondsInADay },
        },
      ]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsSoftDelete, {
        enabled: true,
        retention: 80,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('supports disabling soft delete', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([defaultSoftDeleteSetting], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      await user.click(getSoftDeleteToggle());
      expect(getRetention()).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([
        {
          settingType: 'GcpBucketSoftDelete',
          config: { retentionDurationInSeconds: 0 },
        },
      ]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsSoftDelete, {
        enabled: false,
        retention: null,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('does not event if the retention time did not change', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([defaultSoftDeleteSetting], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });
      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([defaultSoftDeleteSetting]);
      // An above case captures testing that there is no event if Save is pressed and the user initially
      // had no soft delete setting (although the default setting is then persisted).
      expect(captureEvent).not.toHaveBeenCalledWith();
    });
  });

  describe('Requester Pays Settings', () => {
    const getRequesterPaysToggle = () => screen.getByLabelText('Requester Pays:');

    it('renders the option as disabled if the user is not an owner', async () => {
      // Arrange
      setup([], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={makeGoogleWorkspace({ accessLevel: 'READER' })} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getRequesterPaysToggle()).toBeDisabled();
    });

    it('renders the option as off if no settings exist', async () => {
      // Arrange
      setup([], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getRequesterPaysToggle()).not.toBeChecked();
    });

    it('renders the option as off if requester pays is disabled', async () => {
      // Arrange
      setup([requesterPaysDisabledSetting], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getRequesterPaysToggle()).not.toBeChecked();
    });

    it('renders the option as on if requester pays is enabled', async () => {
      // Arrange
      setup([requesterPaysEnabledSetting], jest.fn());

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      // Assert
      expect(getRequesterPaysToggle()).toBeChecked();
    });

    it('supports disabling requester pays', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([requesterPaysEnabledSetting], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const toggle = getRequesterPaysToggle();
      expect(toggle).toBeChecked();
      await user.click(toggle);
      expect(toggle).not.toBeChecked();

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([requesterPaysDisabledSetting, defaultSoftDeleteSetting]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsRequesterPays, {
        enabled: false,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('supports enabling requester pays', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });

      const toggle = getRequesterPaysToggle();
      expect(toggle).not.toBeChecked();
      await user.click(toggle);
      expect(toggle).toBeChecked();

      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([requesterPaysEnabledSetting, defaultSoftDeleteSetting]);
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceSettingsRequesterPays, {
        enabled: true,
        ...extractWorkspaceDetails(defaultGoogleWorkspace),
      });
    });

    it('does not event if requester pays did not change', async () => {
      // Arrange
      const user = userEvent.setup();
      const updateSettingsMock = jest.fn();
      setup([requesterPaysEnabledSetting], updateSettingsMock);

      // Act
      await act(async () => {
        render(<SettingsModal workspace={defaultGoogleWorkspace} onDismiss={jest.fn()} />);
      });
      await user.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(updateSettingsMock).toHaveBeenCalledWith([requesterPaysEnabledSetting, defaultSoftDeleteSetting]);
      expect(captureEvent).not.toHaveBeenCalledWith();
    });
  });
});
