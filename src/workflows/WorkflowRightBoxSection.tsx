import React from 'react';
import { RightBoxSection, RightBoxSectionProps } from 'src/components/RightBoxSection';

export const WorkflowRightBoxSection = (props: RightBoxSectionProps) => {
  return <RightBoxSection {...props}>{props.children}</RightBoxSection>;
};
