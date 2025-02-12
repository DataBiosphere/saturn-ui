import axe from '@axe-core/react';
import React from 'react';
import ReactDOM from 'react-dom';

import { initAxeTools } from './axe-core';

type AxeCoreExports = {
  __esModule: true;
  default: typeof import('@axe-core/react');
};
jest.mock(
  '@axe-core/react',
  (): AxeCoreExports => ({
    __esModule: true,
    default: jest.fn(),
  })
);
describe('initAxeTools', () => {
  it('initializes Axe Tools with desired settings', async () => {
    // Act
    await initAxeTools();

    // Assert
    expect(axe).toBeCalledTimes(1);
    expect(axe).toBeCalledWith(React, ReactDOM, 1000, {
      tags: ['wcag2a', 'wcag2aa'],
      rules: [
        {
          id: 'color-contrast',
          excludeHidden: true,
        },
      ],
    });
  });
});
