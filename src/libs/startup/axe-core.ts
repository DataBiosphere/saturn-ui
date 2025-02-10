import axe from '@axe-core/react';
import React from 'react';
import ReactDOM from 'react-dom';

export const initAxeTools = async () => {
  const config = {
    tags: ['wcag2a', 'wcag2aa'],
    rules: [
      {
        id: 'color-contrast',
        excludeHidden: true,
      },
    ],
  };

  await axe(React, ReactDOM, 1000, config);
};
