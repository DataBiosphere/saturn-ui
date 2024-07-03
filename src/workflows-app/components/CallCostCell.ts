import { useEffect, useState } from 'react';
import { div } from 'react-hyperscript-helpers';
import { centeredSpinner } from 'src/components/icons';
import { renderInProgressElement, renderTaskCostElement } from 'src/components/job-common';

export interface CallCostCellProps {
  call: any;
  getCostOfCallFn: (fullyQualifiedCallPath: string) => number | undefined;
  isCostMetadataLoading: boolean;
}

const isTask = (call: any): boolean => {
  return call?.subWorkflowId === undefined;
};

const isCostDataAbsent = (task) => {
  // If the task failed, was call cached, or never started, we won't have cost data
  if (task?.executionStatus === 'Failed' || task?.callCaching?.hit === true) {
    return true;
  }
};

export const CallCostCell = (props: CallCostCellProps) => {
  const { taskName, executionStatus } = props?.call || {};

  const [calculatedCost, setCalculatedCost] = useState<number | undefined>();

  useEffect(() => {
    const calculateCost = async () => {
      const calculatedCost = props.getCostOfCallFn(taskName);
      setCalculatedCost(calculatedCost);
    };
    calculateCost();
  }, [taskName, props]);

  // Every call should have a 'taskName' field.
  // If we don't have it, we're still loading.
  // Checking two conditions because they come from different web requests.
  if (!taskName || props.isCostMetadataLoading) {
    return centeredSpinner();
  }

  if (calculatedCost && executionStatus === 'Running') {
    return div({}, [renderInProgressElement({ status: executionStatus }), renderTaskCostElement(calculatedCost)]);
  }

  if (isTask(props.call) && isCostDataAbsent(props.call)) {
    return div({}, ['-']);
  }

  return div({}, [calculatedCost !== undefined ? renderTaskCostElement(calculatedCost) : '-']);
};
