import { DeepPartial } from '@terra-ui-packages/core-utils';
import { asMockedFn } from '@terra-ui-packages/test-utils';
import { PersistentDisk } from 'src/libs/ajax/leonardo/models/disk-models';
import { Runtime } from 'src/libs/ajax/leonardo/models/runtime-models';
import { getTerraUser, TerraUser } from 'src/libs/state';

import { environmentsPermissions } from './environmentsPermissions';

jest.mock('src/libs/state', () => ({
  ...jest.requireActual('src/libs/state'),
  getTerraUser: jest.fn(),
}));
describe('environmentsPermissions', () => {
  it('allows disk delete for permitted user', () => {
    // Arrange
    asMockedFn(getTerraUser).mockReturnValue({
      email: 'me@here.org',
    } as Partial<TerraUser> as TerraUser);

    const myDisk: PersistentDisk = {
      auditInfo: { creator: 'me@here.org' },
    } as DeepPartial<PersistentDisk> as PersistentDisk;

    // Act
    const canIDeleteDisk = environmentsPermissions.canDeleteDisk(myDisk);

    // Assert
    expect(canIDeleteDisk).toBe(true);
  });
  it('blocks disk delete for non-permitted user', () => {
    // Arrange
    asMockedFn(getTerraUser).mockReturnValue({
      email: 'me@here.org',
    } as Partial<TerraUser> as TerraUser);

    const otherDisk: PersistentDisk = {
      auditInfo: { creator: 'you@there.org' },
    } as DeepPartial<PersistentDisk> as PersistentDisk;

    // Act
    const canIDeleteDisk = environmentsPermissions.canDeleteDisk(otherDisk);

    // Assert
    expect(canIDeleteDisk).toBe(false);
  });
  it('allows resource pause for permitted user', () => {
    // Arrange
    asMockedFn(getTerraUser).mockReturnValue({
      email: 'me@here.org',
    } as Partial<TerraUser> as TerraUser);

    const myRuntime: Runtime = {
      auditInfo: { creator: 'me@here.org' },
    } as DeepPartial<Runtime> as Runtime;

    // Act
    const canIDeleteDisk = environmentsPermissions.canPauseResource(myRuntime);

    // Assert
    expect(canIDeleteDisk).toBe(true);
  });
  it('blocks resource pausing for non-permitted user', () => {
    // Arrange
    asMockedFn(getTerraUser).mockReturnValue({
      email: 'me@here.org',
    } as Partial<TerraUser> as TerraUser);

    const otherRuntime: Runtime = {
      auditInfo: { creator: 'you@there.org' },
    } as DeepPartial<Runtime> as Runtime;

    // Act
    const canIDeleteDisk = environmentsPermissions.canPauseResource(otherRuntime);

    // Assert
    expect(canIDeleteDisk).toBe(false);
  });
});
