import { GoogleStorage, GoogleStorageContract } from 'src/libs/ajax/GoogleStorage';
import { AsyncRuntimeFields, GetRuntimeItem } from 'src/libs/ajax/leonardo/models/runtime-models';
import {
  RuntimeAjaxContractV1,
  RuntimeAjaxContractV2,
  Runtimes,
  RuntimesAjaxContract,
  RuntimeWrapperAjaxContract,
} from 'src/libs/ajax/leonardo/Runtimes';
import { asMockedFn, partial } from 'src/testing/test-utils';

import { leoRuntimeProvider, RuntimeBasics, RuntimeErrorInfo } from './LeoRuntimeProvider';

jest.mock('src/libs/ajax/GoogleStorage');
jest.mock('src/libs/ajax/leonardo/Runtimes');

type RuntimesNeeds = Pick<RuntimesAjaxContract, 'listV2' | 'runtime' | 'runtimeV2' | 'runtimeWrapper'>;
type RuntimeV1Needs = Pick<RuntimeAjaxContractV1, 'delete' | 'details'>;
type RuntimeV2Needs = Pick<RuntimeAjaxContractV2, 'delete' | 'details'>;
type RuntimeWrapperNeeds = Pick<RuntimeWrapperAjaxContract, 'stop'>;
type BucketsNeeds = Pick<GoogleStorageContract, 'getObjectPreview'>;

interface AjaxMockNeeds {
  runtimes: RuntimesNeeds;
  runtimeV1: RuntimeV1Needs;
  runtimeV2: RuntimeV2Needs;
  runtimeWrapper: RuntimeWrapperNeeds;
  buckets: BucketsNeeds;
}

/**
 * local test utility - sets up mocks for needed ajax data-calls with as much type-saftely as possible.
 *
 * @return collection of key data-call fns for easy
 * mock overrides and/or method spying/assertions
 */
const mockAjaxNeeds = (): AjaxMockNeeds => {
  const runtimeV1: RuntimeV1Needs = {
    delete: jest.fn(),
    details: jest.fn(),
  };
  const runtimeV2: RuntimeV2Needs = {
    delete: jest.fn(),
    details: jest.fn(),
  };
  const runtimeWrapper: RuntimeWrapperNeeds = {
    stop: jest.fn(),
  };
  // Ajax.runtimes root
  const runtimes: RuntimesNeeds = {
    listV2: jest.fn(),
    runtime: jest.fn(),
    runtimeV2: jest.fn(),
    runtimeWrapper: jest.fn(),
  };
  asMockedFn(runtimes.runtime).mockReturnValue(partial<RuntimeAjaxContractV1>(runtimeV1));
  asMockedFn(runtimes.runtimeV2).mockReturnValue(partial<RuntimeAjaxContractV2>(runtimeV2));
  asMockedFn(runtimes.runtimeWrapper).mockReturnValue(partial<RuntimeWrapperAjaxContract>(runtimeWrapper));

  const buckets: BucketsNeeds = {
    getObjectPreview: jest.fn(),
  };

  asMockedFn(Runtimes).mockReturnValue(partial<RuntimesAjaxContract>(runtimes));
  asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>(buckets));

  return { runtimes, runtimeV1, runtimeV2, runtimeWrapper, buckets };
};
describe('leoRuntimeProvider', () => {
  it('handles list runtimes call', async () => {
    // Arrange
    const ajaxMock = mockAjaxNeeds();
    asMockedFn(ajaxMock.runtimes.listV2).mockResolvedValue([]);
    const signal = new window.AbortController().signal;

    // Act
    const result = await leoRuntimeProvider.list({ arg: '1' }, { signal });

    // Assert;
    expect(Runtimes).toBeCalledTimes(1);
    expect(Runtimes).toBeCalledWith(signal);
    expect(ajaxMock.runtimes.listV2).toBeCalledTimes(1);
    expect(ajaxMock.runtimes.listV2).toBeCalledWith({ arg: '1' });
    expect(result).toEqual([]);
  });

  describe('errorInfo call', () => {
    it('handles GCP', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();

      const abort = new window.AbortController();

      const runtime: RuntimeBasics = {
        runtimeName: 'myRuntime',
        cloudContext: {
          cloudProvider: 'GCP',
          cloudResource: 'myGoogleResource',
        },
        googleProject: 'myGoogleProject',
      };
      asMockedFn(ajaxMock.runtimeV1.details).mockResolvedValue({
        errors: [{ errorCode: 123, errorMessage: 'runtime error 1', timestamp: '0:00' }],
      } satisfies Partial<GetRuntimeItem> as GetRuntimeItem);

      // Act
      const errorInfo = await leoRuntimeProvider.errorInfo(runtime, { signal: abort.signal });

      // Assert;
      expect(Runtimes).toBeCalledTimes(1);
      expect(Runtimes).toBeCalledWith(abort.signal);
      expect(ajaxMock.runtimes.runtime).toBeCalledTimes(1);
      expect(ajaxMock.runtimes.runtime).toBeCalledWith('myGoogleProject', 'myRuntime');
      expect(ajaxMock.runtimeV1.details).toBeCalledTimes(1);

      expect(errorInfo).toEqual({
        errorType: 'ErrorList',
        errors: [{ errorCode: 123, errorMessage: 'runtime error 1', timestamp: '0:00' }],
      } satisfies RuntimeErrorInfo);
    });

    it('handles GCP with user script error', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();

      const abort = new window.AbortController();

      const runtime: RuntimeBasics = {
        runtimeName: 'myRuntime',
        cloudContext: {
          cloudProvider: 'GCP',
          cloudResource: 'myGoogleResource',
        },
        googleProject: 'myGoogleProject',
      };
      asMockedFn(ajaxMock.runtimeV1.details).mockResolvedValue(
        partial<GetRuntimeItem>({
          asyncRuntimeFields: partial<AsyncRuntimeFields>({ stagingBucket: 'myBucket' }),
          errors: [{ errorCode: 123, errorMessage: 'Userscript failed: See bucket for details', timestamp: '0:00' }],
        })
      );
      asMockedFn(ajaxMock.buckets.getObjectPreview).mockResolvedValue(
        new Response('Error: MeaningOfLife is undefined')
      );

      // Act
      const errorInfo = await leoRuntimeProvider.errorInfo(runtime, { signal: abort.signal });

      // Assert;
      expect(Runtimes).toBeCalledTimes(1);
      expect(Runtimes).toBeCalledWith(abort.signal);
      expect(ajaxMock.runtimes.runtime).toBeCalledTimes(1);
      expect(ajaxMock.runtimes.runtime).toBeCalledWith('myGoogleProject', 'myRuntime');
      expect(ajaxMock.runtimeV1.details).toBeCalledTimes(1);
      expect(ajaxMock.buckets.getObjectPreview).toBeCalledTimes(1);
      expect(ajaxMock.buckets.getObjectPreview).toBeCalledWith(
        'myGoogleProject',
        'myBucket',
        'userscript_output.txt',
        true
      );

      expect(errorInfo).toEqual({
        errorType: 'UserScriptError',
        detail: 'Error: MeaningOfLife is undefined',
      } satisfies RuntimeErrorInfo);
    });

    it('handles Azure', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();

      const abort = new window.AbortController();

      const runtime: RuntimeBasics = {
        runtimeName: 'myRuntime',
        cloudContext: {
          cloudProvider: 'AZURE',
          cloudResource: 'myAzureResource',
        },
        workspaceId: 'myWorkspace',
      };
      asMockedFn(ajaxMock.runtimeV2.details).mockResolvedValue(
        partial<GetRuntimeItem>({
          errors: [{ errorCode: 123, errorMessage: 'runtime error 1', timestamp: '0:00' }],
        })
      );

      // Act
      const errorInfo = await leoRuntimeProvider.errorInfo(runtime, { signal: abort.signal });

      // Assert;
      expect(Runtimes).toBeCalledTimes(1);
      expect(Runtimes).toBeCalledWith(abort.signal);
      expect(ajaxMock.runtimes.runtimeV2).toBeCalledTimes(1);
      expect(ajaxMock.runtimes.runtimeV2).toBeCalledWith('myWorkspace', 'myRuntime');
      expect(ajaxMock.runtimeV2.details).toBeCalledTimes(1);

      expect(errorInfo).toEqual({
        errorType: 'ErrorList',
        errors: [{ errorCode: 123, errorMessage: 'runtime error 1', timestamp: '0:00' }],
      } satisfies RuntimeErrorInfo);
    });
  });

  it('handles stop runtime call', async () => {
    // Arrange
    const ajaxMock = mockAjaxNeeds();

    const abort = new window.AbortController();

    const runtime: RuntimeBasics = {
      runtimeName: 'myRuntime',
      cloudContext: {
        cloudProvider: 'GCP',
        cloudResource: 'myGoogleResource',
      },
      googleProject: 'myGoogleProject',
    };

    // Act
    void (await leoRuntimeProvider.stop(runtime, { signal: abort.signal }));

    // Assert;
    expect(Runtimes).toBeCalledTimes(1);
    expect(Runtimes).toBeCalledWith(abort.signal);
    expect(ajaxMock.runtimes.runtimeWrapper).toBeCalledTimes(1);
    expect(ajaxMock.runtimes.runtimeWrapper).toBeCalledWith(runtime);
    expect(ajaxMock.runtimeWrapper.stop).toBeCalledTimes(1);
  });

  it('handles delete runtime call for GCP', async () => {
    // Arrange
    const ajaxMock = mockAjaxNeeds();
    const abort = new window.AbortController();
    const runtime: RuntimeBasics = {
      runtimeName: 'myRuntime',
      cloudContext: {
        cloudProvider: 'GCP',
        cloudResource: 'myGoogleResource',
      },
      googleProject: 'myGoogleProject',
    };

    // Act
    // calls to this method generally don't care about passing in signal, but doing it here for completeness
    void (await leoRuntimeProvider.delete(runtime, { signal: abort.signal }));

    // Assert;
    expect(Runtimes).toBeCalledTimes(1);
    expect(Runtimes).toBeCalledWith(abort.signal);
    expect(ajaxMock.runtimes.runtime).toBeCalledTimes(1);
    expect(ajaxMock.runtimes.runtime).toBeCalledWith('myGoogleProject', 'myRuntime');
    expect(ajaxMock.runtimeV1.delete).toBeCalledTimes(1);
    expect(ajaxMock.runtimeV1.delete).toBeCalledWith(false);
  });

  it('handles delete runtime call for Azure', async () => {
    // Arrange
    const ajaxMock = mockAjaxNeeds();
    const abort = new window.AbortController();
    const runtime: RuntimeBasics = {
      runtimeName: 'myRuntime',
      cloudContext: {
        cloudProvider: 'AZURE',
        cloudResource: 'myGoogleResource',
      },
      workspaceId: 'myWorkspaceId',
    };

    // Act
    // calls to this method generally don't care about passing in signal, but doing it here for completeness
    void (await leoRuntimeProvider.delete(runtime, { deleteDisk: true, signal: abort.signal }));

    // Assert;
    expect(Runtimes).toBeCalledTimes(1);
    expect(Runtimes).toBeCalledWith(abort.signal);
    expect(ajaxMock.runtimes.runtimeV2).toBeCalledTimes(1);
    expect(ajaxMock.runtimes.runtimeV2).toBeCalledWith('myWorkspaceId', 'myRuntime');
    expect(ajaxMock.runtimeV2.delete).toBeCalledTimes(1);
    expect(ajaxMock.runtimeV2.delete).toBeCalledWith(true);
  });
});
