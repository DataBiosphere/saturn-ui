import React from 'react';
import { TextArea } from 'src/components/input';

export interface MockWDLEditorProps {
  wdl: string;
  onChange: (wdl: string) => void;
}

/**
 * This component can be used to mock the WDLEditor component, which is unable
 * to load properly in a test environment due to its use of the Monaco editor.
 */
export const MockWDLEditor = (props: MockWDLEditorProps) => {
  const { wdl, onChange } = props;
  return (
    <div>
      {/* the test ID allows for direct access to the text area for testing;
       the actual Monaco editor has a built-in ARIA label at the contents of the
       editor */}
      <TextArea value={wdl} onChange={onChange} data-testid='wdl editor' />
    </div>
  );
};
