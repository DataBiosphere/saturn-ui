import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { Runtimes } from 'src/libs/ajax/leonardo/Runtimes';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';

const AjaxTestingRoot = (signal?: AbortSignal) => {
  return {
    Apps: Apps(signal), // used for e2e testing
    Runtimes: Runtimes(signal), // used for e2e testing
    Workspaces: Workspaces(signal), // used for e2e testing
  };
};

export type AjaxTestingContract = ReturnType<typeof AjaxTestingRoot>;

export const setupAjaxTestUtil = () => {
  // Exposing Ajax for use by integration tests (and debugging, or whatever)
  (window as any).Ajax = AjaxTestingRoot;
};
