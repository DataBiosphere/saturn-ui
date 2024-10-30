import { render, screen } from '@testing-library/react';
import React from 'react';
import { WDLEditor } from 'src/workflows/methods-repo/WDLEditor';

describe('WDLEditor', () => {
  it('renders the editor', () => {
    const { container } = render(<WDLEditor wdl='hi' />);

    const editorElement = container.firstChild?.firstChild;

    // Not the cleanest check, but it's currently the best way to verify the Editor has rendered on the page
    expect(editorElement).toHaveAttribute(
      'style',
      'display: flex; position: relative; text-align: initial; width: 100%; height: 300px;'
    );
    expect(screen.getByText('Loading...'));
  });
});
