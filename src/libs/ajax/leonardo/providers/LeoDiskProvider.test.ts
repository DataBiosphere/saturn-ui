import { RawGetDiskItem } from '@terra-ui-packages/leonardo-data-client';
import { generateTestDisk, getPersistentDiskDetail, undecoratePd } from 'src/analysis/_testData/testData';
import {
  Disks,
  DisksContractV1,
  DisksContractV2,
  DisksDataClientContract,
  DiskWrapperContract,
} from 'src/libs/ajax/leonardo/Disks';
import { asMockedFn } from 'src/testing/test-utils';

import { DiskBasics, leoDiskProvider } from './LeoDiskProvider';

jest.mock('src/libs/ajax/leonardo/Disks');

type DiskNeeds = Pick<DiskWrapperContract, 'delete' | 'details' | 'update'>;
type DisksV1Needs = Pick<DisksContractV1, 'list' | 'disk'>;
type DisksV2Needs = Pick<DisksContractV2, 'delete'>;

interface DiskMockNeeds {
  DisksV1: DisksV1Needs;
  DisksV2: DisksV2Needs;
  disk: DiskNeeds;
}

/**
 * local test utility - sets up mocks for needed ajax data-calls with as much type-saftely as possible.
 *
 * @return collection of key data-call fns for easy
 * mock overrides and/or method spying/assertions
 */
const mockDiskNeeds = (): DiskMockNeeds => {
  const partialDisk: DiskNeeds = {
    delete: jest.fn(),
    details: jest.fn(),
    update: jest.fn(),
  };
  const mockDisk = partialDisk as DiskWrapperContract;

  const partialDisksV1: DisksV1Needs = {
    disk: jest.fn(),
    list: jest.fn(),
  };
  const mockDisksV1 = partialDisksV1 as DisksContractV1;

  const partialDisksV2: DisksV2Needs = {
    delete: jest.fn(),
  };
  const mockDisksV2 = partialDisksV2 as DisksContractV2;

  asMockedFn(mockDisksV1.disk).mockReturnValue(mockDisk);

  // Ajax.Disks root
  const mockDisks: DisksDataClientContract = {
    disksV1: jest.fn(),
    disksV2: jest.fn(),
  };
  asMockedFn(mockDisks.disksV1).mockReturnValue(mockDisksV1);
  asMockedFn(mockDisks.disksV2).mockReturnValue(mockDisksV2);

  asMockedFn(Disks).mockReturnValue(mockDisks);

  return {
    DisksV1: partialDisksV1,
    DisksV2: partialDisksV2,
    disk: partialDisk,
  };
};
describe('leoDiskProvider', () => {
  it('handles list call', async () => {
    // Arrange
    const diskMock = mockDiskNeeds();
    const disk = generateTestDisk();
    asMockedFn(diskMock.DisksV1.list).mockResolvedValue([undecoratePd(disk)]);
    const signal = new window.AbortController().signal;

    // Act
    const result = await leoDiskProvider.list({ arg: '1' }, { signal });

    // Assert;
    expect(Disks).toBeCalledTimes(1);
    expect(Disks).toBeCalledWith(signal);
    expect(diskMock.DisksV1.list).toBeCalledTimes(1);
    expect(diskMock.DisksV1.list).toBeCalledWith({ arg: '1' });
    expect(result).toEqual([disk]);
  });

  it('handles delete disk call for GCP', async () => {
    // Arrange
    const diskMock = mockDiskNeeds();
    const abort = new window.AbortController();
    const disk: DiskBasics = {
      name: 'myDiskName',
      id: 123,
      cloudContext: {
        cloudProvider: 'GCP',
        cloudResource: 'myGoogleProject',
      },
    };

    // Act
    // calls to this method generally don't care about passing in signal, but doing it here for completeness
    void (await leoDiskProvider.delete(disk, { signal: abort.signal }));

    // Assert;
    expect(Disks).toBeCalledTimes(1);
    expect(Disks).toBeCalledWith(abort.signal);
    expect(diskMock.DisksV1.disk).toBeCalledTimes(1);
    expect(diskMock.DisksV1.disk).toBeCalledWith('myGoogleProject', 'myDiskName');
    expect(diskMock.disk.delete).toBeCalledTimes(1);
  });

  it('handles delete disk call for Azure', async () => {
    // Arrange
    const diskMock = mockDiskNeeds();
    const abort = new window.AbortController();
    const disk: DiskBasics = {
      name: 'myDiskName',
      id: 123,
      cloudContext: {
        cloudProvider: 'AZURE',
        cloudResource: 'myAzureResource',
      },
    };

    // Act
    // calls to this method generally don't care about passing in signal, but doing it here for completeness
    void (await leoDiskProvider.delete(disk, { signal: abort.signal }));

    // Assert;
    expect(Disks).toBeCalledTimes(1);
    expect(Disks).toBeCalledWith(abort.signal);
    expect(diskMock.DisksV2.delete).toBeCalledTimes(1);
    expect(diskMock.DisksV2.delete).toBeCalledWith(123);
  });

  it('handles details call for GCP', async () => {
    const diskMock = mockDiskNeeds();
    const abort = new window.AbortController();
    const disk = getPersistentDiskDetail();
    asMockedFn(diskMock.disk.details).mockResolvedValue(undecoratePd(disk) as RawGetDiskItem);

    // Act
    // calls to this method generally don't care about passing in signal, but doing it here for completeness
    const details = await leoDiskProvider.details(disk, { signal: abort.signal });

    // Assert;
    expect(Disks).toBeCalledTimes(1);
    expect(Disks).toBeCalledWith(abort.signal);
    expect(diskMock.DisksV1.disk).toBeCalledTimes(1);
    expect(diskMock.DisksV1.disk).toBeCalledWith(disk.cloudContext.cloudResource, disk.name);
    expect(diskMock.disk.details).toBeCalledTimes(1);
    expect(details).toEqual(disk);
  });

  it('handles update call for GCP', async () => {
    const diskMock = mockDiskNeeds();
    const abort = new window.AbortController();
    const disk: DiskBasics = {
      name: 'myDiskName',
      id: 123,
      cloudContext: {
        cloudProvider: 'GCP',
        cloudResource: 'myGoogleProject',
      },
    };

    // Act
    // calls to this method generally don't care about passing in signal, but doing it here for completeness
    void (await leoDiskProvider.update(disk, 100, { signal: abort.signal }));

    // Assert;
    expect(Disks).toBeCalledTimes(1);
    expect(Disks).toBeCalledWith(abort.signal);
    expect(diskMock.DisksV1.disk).toBeCalledTimes(1);
    expect(diskMock.DisksV1.disk).toBeCalledWith('myGoogleProject', 'myDiskName');
    expect(diskMock.disk.update).toBeCalledTimes(1);
    expect(diskMock.disk.update).toBeCalledWith(100);
  });
});
