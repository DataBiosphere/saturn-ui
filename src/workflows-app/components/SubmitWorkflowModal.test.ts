import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { appAccessScopes, appToolLabels } from 'src/analysis/utils/tool-utils';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Cbas, CbasAjaxContract } from 'src/libs/ajax/workflows-app/Cbas';
import { getTerraUser, workflowsAppStore } from 'src/libs/state';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import { SubmitWorkflowModal } from 'src/workflows-app/components/SubmitWorkflowModal';
import { methodDataWithVersions } from 'src/workflows-app/utils/mock-data';
import {
  mockAzureWorkspace,
  mockCromwellRunner,
  mockWdsApp,
  mockWorkflowsApp,
  runSetInputDef,
  runSetOutputDefFilled,
  searchResponseFOO,
} from 'src/workflows-app/utils/mock-responses';

jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/workflows-app/Cbas');

jest.mock('src/libs/notifications');

jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  goToPath: jest.fn(),
}));

jest.mock('src/libs/state', () => ({
  ...jest.requireActual('src/libs/state'),
  getTerraUser: jest.fn().mockReturnValue({ id: 'foo' }),
}));

jest.mock('src/libs/utils', () => ({
  ...jest.requireActual('src/libs/utils'),
  poll: jest.fn(async (fn) => {
    // remove delay
    while (true) {
      const r = await fn();
      if (!r.shouldContinue) {
        return r.result;
      }
    }
  }),
}));

type UseMetricsExports = typeof import('src/libs/ajax/metrics/useMetrics');
jest.mock(
  'src/libs/ajax/metrics/useMetrics',
  (): UseMetricsExports => ({
    ...jest.requireActual<UseMetricsExports>('src/libs/ajax/metrics/useMetrics'),
    useMetricsEvent: jest.fn(() => ({ captureEvent: jest.fn() })),
  })
);

jest.mock('src/libs/feature-previews', () => ({
  ...jest.requireActual('src/libs/feature-previews'),
  isFeaturePreviewEnabled: jest.fn(),
}));

const baseSubmitModalProps = {
  method: methodDataWithVersions.methods[0],
  methodVersion: methodDataWithVersions.methods[0].method_versions[0],
  recordType: 'FOO',
  selectedRecords: { FOO1: searchResponseFOO.records[0] },
  inputDefinition: runSetInputDef,
  outputDefinition: runSetOutputDefFilled,
  callCachingEnabled: true,
  onDismiss: jest.fn(),
  name: 'test-azure-ws-name',
  namespace: 'test-azure-ws-namespace',
  workspace: mockAzureWorkspace,
};

const submitModalPropsReader = {
  ...baseSubmitModalProps,
  workspace: {
    ...mockAzureWorkspace,
    canCompute: false,
  },
};

const postRunSetPayload = expect.objectContaining({
  method_version_id: methodDataWithVersions.methods[0].method_versions[0].method_version_id,
  workflow_input_definitions: runSetInputDef,
  workflow_output_definitions: runSetOutputDefFilled,
  wds_records: {
    record_type: 'FOO',
    record_ids: ['FOO1'],
  },
  call_caching_enabled: true,
});

describe('SubmitWorkflowModal', () => {
  const testCases: Array<{
    role: 'CREATOR' | 'WRITER' | 'READER';
    canSubmit: boolean;
    cromwellRunnerStates: Array<'NONE' | 'RUNNING' | 'PROVISIONING' | 'ERROR'>;
  }> = [
    {
      role: 'CREATOR',
      canSubmit: true,
      cromwellRunnerStates: ['RUNNING'],
    },
    {
      role: 'WRITER',
      canSubmit: true,
      cromwellRunnerStates: ['RUNNING'],
    },
    {
      role: 'READER',
      canSubmit: false,
      cromwellRunnerStates: [],
    },
    {
      role: 'CREATOR',
      canSubmit: true,
      cromwellRunnerStates: ['PROVISIONING', 'RUNNING'],
    },
    {
      role: 'WRITER',
      canSubmit: true,
      cromwellRunnerStates: ['PROVISIONING', 'RUNNING'],
    },
    {
      role: 'READER',
      canSubmit: false,
      cromwellRunnerStates: [],
    },
    {
      role: 'CREATOR',
      canSubmit: true,
      cromwellRunnerStates: ['NONE', 'PROVISIONING', 'RUNNING'],
    },
    {
      role: 'WRITER',
      canSubmit: true,
      cromwellRunnerStates: ['NONE', 'PROVISIONING', 'PROVISIONING', 'RUNNING'],
    },
    {
      role: 'READER',
      canSubmit: false,
      cromwellRunnerStates: [],
    },
    {
      role: 'WRITER',
      canSubmit: true,
      cromwellRunnerStates: ['NONE', 'PROVISIONING', 'ERROR'],
    },
  ];

  it.each(
    testCases.map((testCase) => ({
      ...testCase,
      testName: `should ${testCase.canSubmit ? '' : 'not '}be able to submit as workspace ${
        testCase.role
      } and initial cromwell runner status ${testCase.cromwellRunnerStates[0]}`,
    }))
  )('$testName', async ({ role, canSubmit, cromwellRunnerStates }) => {
    // ** ARRANGE **
    workflowsAppStore.reset();
    const userEmail = role === 'CREATOR' ? 'groot@gmail.com' : 'not-groot@gmail.com';
    const appToSubmitTo = mockWorkflowsApp;
    asMockedFn(getTerraUser).mockReturnValue({ email: userEmail });

    const user = userEvent.setup();
    const postRunSetFunction = jest.fn();
    const createAppV2 = jest.fn();
    const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = cromwellRunnerStates.reduce(
      (prev, current) =>
        prev.mockImplementationOnce((_id) =>
          Promise.resolve([
            mockWdsApp,
            appToSubmitTo,
            ...(current !== 'NONE' ? [mockCromwellRunner(current, userEmail)] : []),
          ] as ListAppItem[])
        ),
      jest.fn((_id) => Promise.resolve([appToSubmitTo, mockWdsApp] as ListAppItem[]))
    );

    asMockedFn(Apps).mockReturnValue(
      partial<AppsAjaxContract>({
        createAppV2,
        listAppsV2,
      })
    );
    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        runSets: partial<CbasAjaxContract['runSets']>({
          post: postRunSetFunction,
        }),
      })
    );

    // ** ACT **
    await act(async () =>
      render(h(SubmitWorkflowModal, role === 'READER' ? submitModalPropsReader : baseSubmitModalProps))
    );

    // ** ASSERT **
    // Launch modal should be displayed
    const modalSubmitButton = screen.getByLabelText('Launch Submission');
    if (!canSubmit) {
      screen.getByText(/you do not have permission to run workflows/i);
      expect(modalSubmitButton).toHaveAttribute('disabled');
    } else {
      expect(modalSubmitButton).not.toHaveAttribute('disabled');
    }

    // ** ACT **
    // user click on Submit button
    await user.click(modalSubmitButton);

    // ** ASSERT **
    if (canSubmit) {
      if (cromwellRunnerStates[0] === 'NONE') {
        expect(createAppV2).toHaveBeenCalledWith(
          expect.anything(),
          mockAzureWorkspace.workspace.workspaceId,
          appToolLabels.CROMWELL_RUNNER_APP,
          appAccessScopes.USER_PRIVATE
        );
      } else {
        expect(createAppV2).not.toHaveBeenCalled();
      }
      // If the app ends up RUNNING:
      if (cromwellRunnerStates.includes('RUNNING')) {
        expect(listAppsV2).toHaveBeenCalledTimes(cromwellRunnerStates.length + 1); // + 1 to get proxy urls
        expect(postRunSetFunction).toHaveBeenCalledWith(appToSubmitTo.proxyUrls.cbas, postRunSetPayload);
      } else if (cromwellRunnerStates.includes('ERROR')) {
        expect(listAppsV2).toHaveBeenCalledTimes(cromwellRunnerStates.length); // no extra call for proxy urls
        expect(postRunSetFunction).not.toHaveBeenCalledWith();
        // Look for the error message:
        screen.getByText(/A problem has occurred launching your personal Cromwell runner/i);
      }
    } else {
      expect(createAppV2).not.toHaveBeenCalled();
      expect(listAppsV2).not.toHaveBeenCalled();
      expect(postRunSetFunction).not.toHaveBeenCalled();
    }
  });
});
