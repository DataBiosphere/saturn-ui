import { addDays, subDays } from 'date-fns';
import { getGoogleRuntime } from 'src/analysis/_testData/testData';
import { getAnalysesDisplayList, getCurrentRuntime } from 'src/analysis/utils/runtime-utils';
import { runtimeStatuses } from 'src/libs/ajax/leonardo/models/runtime-models';

jest.mock('src/analysis/utils/gce-machines', () => {
  const originalModule = jest.requireActual('src/analysis/utils/gce-machines');

  return {
    ...originalModule,
    regionToPrices: [
      {
        name: 'US-CENTRAL1',
        monthlyStandardDiskPrice: 0.04,
        monthlySSDDiskPrice: 0.17,
        monthlyBalancedDiskPrice: 0.1,
        n1HourlyGBRamPrice: 0.004237,
        n1HourlyCpuPrice: 0.031611,
        preemptibleN1HourlyGBRamPrice: 0.000892,
        preemptibleN1HourlyCpuPrice: 0.006655,
        t4HourlyPrice: 0.35,
        p4HourlyPrice: 0.6,
        v100HourlyPrice: 2.48,
        p100HourlyPrice: 1.46,
        preemptibleT4HourlyPrice: 0.11,
        preemptibleP4HourlyPrice: 0.216,
        preemptibleV100HourlyPrice: 0.74,
        preemptibleP100HourlyPrice: 0.43,
      },
    ],
  };
});

const mockBucketAnalyses = [
  {
    kind: 'storage#object',
    id: 'fc-703dc22f-e644-4349-b613-87f20a385429/notebooks/testA.Rmd/1650041141891593',
    name: 'notebooks/testA.Rmd',
    bucket: 'fc-703dc22f-e644-4349-b613-87f20a385429',
    generation: '1650041141891593',
    contentType: 'application/octet-stream',
    storageClass: 'STANDARD',
    size: '830',
    md5Hash: 'oOU8DFHszwwo9BbLKxmOyw==',
    crc32c: '6sSeiw==',
    etag: 'CImkgqHClvcCEB0=',
    timeCreated: '2022-04-15T16:45:41.962Z',
    updated: '2022-04-15T17:03:58.139Z',
    timeStorageClassUpdated: '2022-04-15T16:45:41.962Z',
    customTime: '1970-01-01T00:00:00Z',
    metadata: {
      be789c74f6bc6d9df95b9f1b7ce07b4b8b6392c1a937f3a69e2de1b508d8690d: 'doNotSync',
      lastModifiedBy: '904998e4258c146e4f94e8bd9c4689b1f759ec384199e58067bfe7efbdd79d68',
    },
  },
  {
    kind: 'storage#object',
    id: 'fc-703dc22f-e644-4349-b613-87f20a385429/notebooks/testB.Rmd/1650042135115055',
    name: 'notebooks/testB.Rmd',
    bucket: 'fc-703dc22f-e644-4349-b613-87f20a385429',
    generation: '1650042135115055',
    contentType: 'application/octet-stream',
    storageClass: 'STANDARD',
    size: '825',
    md5Hash: 'BW6DMzy4jK74aB2FQikGxA==',
    crc32c: '2GXfVA==',
    etag: 'CK/qz/rFlvcCEAM=',
    timeCreated: '2022-04-15T17:02:15.185Z',
    updated: '2022-04-15T17:03:58.177Z',
    timeStorageClassUpdated: '2022-04-15T17:02:15.185Z',
    metadata: {
      be789c74f6bc6d9df95b9f1b7ce07b4b8b6392c1a937f3a69e2de1b508d8690d: 'doNotSync',
      lastModifiedBy: '904998e4258c146e4f94e8bd9c4689b1f759ec384199e58067bfe7efbdd79d68',
    },
  },
];

describe('getCurrentRuntime', () => {
  it('returns undefined if no runtimes exist', () => {
    expect(getCurrentRuntime([])).toBeUndefined();
  });
  it('returns a runtime if 1 exists', () => {
    const runtime1 = getGoogleRuntime();
    expect(getCurrentRuntime([runtime1])).toStrictEqual(runtime1);
  });
  it('returns no runtimes if only deleting runtimes exists', () => {
    const runtime1 = getGoogleRuntime({ status: runtimeStatuses.deleting.leoLabel });
    const runtime2 = getGoogleRuntime({ status: runtimeStatuses.deleting.leoLabel });
    expect(getCurrentRuntime([runtime1, runtime2])).toBeUndefined();
  });
  it('returns the most recent runtime in a list', () => {
    // chronologically, runtime1 is the middle, runtime2 the most recent, and runtime3 the oldest
    // getCurrentRuntime should return the most recent
    const runtime1 = getGoogleRuntime();
    const runtime2WithSameDate = getGoogleRuntime();
    const runtime3WithSameDate = getGoogleRuntime();

    const runtime2 = {
      ...runtime2WithSameDate,
      auditInfo: {
        ...runtime1.auditInfo,
        createdDate: addDays(new Date(runtime1.auditInfo.createdDate), 3).toString(),
      },
    };

    const runtime3 = {
      ...runtime3WithSameDate,
      auditInfo: {
        ...runtime1.auditInfo,
        createdDate: subDays(new Date(runtime1.auditInfo.createdDate), 3).toString(),
      },
    };

    expect(getCurrentRuntime([runtime1, runtime2, runtime3])).toStrictEqual(runtime2);
  });
});

describe('getDisplayList', () => {
  it('getDisplayList should return a string of the analysis names, comma separated', () => {
    expect(getAnalysesDisplayList(mockBucketAnalyses)).toBe('testA.Rmd, testB.Rmd');
  });
});
