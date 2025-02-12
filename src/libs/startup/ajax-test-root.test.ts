import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { Runtimes, RuntimesAjaxContract } from 'src/libs/ajax/leonardo/Runtimes';
import { Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';

import { AjaxTestingContract, setupAjaxTestUtil } from './ajax-test-root';

jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/leonardo/Runtimes');
jest.mock('src/libs/ajax/workspaces/Workspaces');

describe('setupAjaxTestUtil', () => {
  beforeEach(() => {
    asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({}));
    asMockedFn(Runtimes).mockReturnValue(partial<RuntimesAjaxContract>({}));
    asMockedFn(Workspaces).mockReturnValue(partial<WorkspacesAjaxContract>({}));
  });

  it('sets up Ajax data-call testing root', () => {
    // Act
    setupAjaxTestUtil();
    const ajaxTestingContract = (window as any).Ajax() as AjaxTestingContract;

    // Assert
    expect(ajaxTestingContract).toBeDefined();
    expect(ajaxTestingContract.Apps).toBeDefined();
    expect(ajaxTestingContract.Runtimes).toBeDefined();
    expect(ajaxTestingContract.Workspaces).toBeDefined();
  });
  it('passes along signal arg to sub-areas', () => {
    // Arrange
    const signal = new AbortController().signal;

    // Act
    setupAjaxTestUtil();
    const ajaxTestingContract = (window as any).Ajax(signal) as AjaxTestingContract;

    // Assert
    expect(ajaxTestingContract).toBeDefined();
    expect(Apps).toBeCalledWith(signal);
    expect(Runtimes).toBeCalledWith(signal);
    expect(Workspaces).toBeCalledWith(signal);
  });
});
