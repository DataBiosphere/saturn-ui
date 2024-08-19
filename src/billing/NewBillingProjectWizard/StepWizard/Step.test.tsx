import { render } from '@testing-library/react';
import { sum } from 'lodash/fp';
import React from 'react';
import { Step } from 'src/billing/NewBillingProjectWizard/StepWizard/Step';

describe('Step', () => {
  it('renders all child props in order', () => {
    const d1 = <div id='d1'>d1Text</div>;
    const d2 = <div id='d2' />;
    const d3 = <div id='d3' />;

    const renderResult = render(
      <Step isActive={false}>
        {d1}
        {d2}
        {d3}
      </Step>
    );

    const stepElem = renderResult.getByText('d1Text')?.parentElement;
    expect(stepElem?.children.length).toBe(3);
    expect(stepElem?.children.item(0)?.id).toBe('d1');
    expect(stepElem?.children.item(1)?.id).toBe('d2');
    expect(stepElem?.children.item(2)?.id).toBe('d3');
  });

  it('sets aria-current to step when active', () => {
    const renderResult = render(
      <div>
        <Step isActive>
          <div>activeStepChild</div>
        </Step>
        <Step isActive={false}>
          <div>inactiveStepChild</div>
        </Step>
      </div>
    );

    const activeStep = renderResult.getByText('activeStepChild')!.parentElement!;
    const inactiveStep = renderResult.getByText('inactiveStepChild')!.parentElement!;

    expect(activeStep.getAttribute('aria-current')).toBe('step');
    expect(inactiveStep.getAttribute('aria-current')).toBe('false');
  });

  it('has a more intense border and lighter background when active', () => {
    const renderResult = render(
      <div>
        <Step isActive>
          <div>activeStepChild</div>
        </Step>
        <Step isActive={false}>
          <div>inactiveStepChild</div>
        </Step>
      </div>
    );
    const activeStyle = getComputedStyle(renderResult.getByText('activeStepChild').parentElement!);
    const inactiveStyle = getComputedStyle(renderResult.getByText('inactiveStepChild').parentElement!);

    const rgbToTotalNumber = (rgb: string) =>
      sum(
        rgb
          .substring(rgb.indexOf('(') + 1, rgb.indexOf(')'))
          .split(',')
          .map((s) => parseInt(s))
      );

    // active background is darker than inactive
    expect(rgbToTotalNumber(activeStyle.backgroundColor)).toBeLessThan(rgbToTotalNumber(inactiveStyle.backgroundColor));
    // active border is darker than inactive
    expect(parseInt(activeStyle.borderColor.substring(1), 16)).toBeLessThan(
      parseInt(inactiveStyle.borderColor.substring(1), 16)
    );
  });
});
