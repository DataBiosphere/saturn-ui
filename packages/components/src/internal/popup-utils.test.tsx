import { render } from '@testing-library/react';
import { useRef } from 'react';

import { computePopupPosition, Position, Side, Size, useBoundingRects } from './popup-utils';

describe('computePopupPosition', () => {
  it.each([
    { preferredSide: 'top', expectedPosition: { top: 320, right: 790, bottom: 420, left: 490 } },
    { preferredSide: 'right', expectedPosition: { top: 430, right: 1000, bottom: 530, left: 700 } },
    { preferredSide: 'bottom', expectedPosition: { top: 540, right: 790, bottom: 640, left: 490 } },
    { preferredSide: 'left', expectedPosition: { top: 430, right: 580, bottom: 530, left: 280 } },
  ] as { preferredSide: Side; expectedPosition: Position }[])(
    'computes position of popup element based on position of target element',
    ({ preferredSide, expectedPosition }) => {
      // Arrange
      const elementSize: Size = { width: 300, height: 100 };
      const viewportSize: Size = {
        width: 1280,
        height: 960,
      };
      const targetPosition: Position = {
        top: 430,
        right: 690,
        bottom: 530,
        left: 590,
      };
      const gap = 10;

      // Act
      const popup = computePopupPosition({
        elementSize,
        gap,
        preferredSide,
        targetPosition,
        viewportSize,
      });

      // Assert
      expect(popup.position).toEqual(expectedPosition);
      expect(popup.side).toBe(preferredSide);
    }
  );

  it.each([
    {
      targetPosition: { top: 50, right: 690, bottom: 150, left: 590 },
      preferredSide: 'top',
      expectedPosition: { top: 160, right: 790, bottom: 260, left: 490 },
      expectedSide: 'bottom',
    },
    {
      targetPosition: { top: 430, right: 1180, bottom: 530, left: 1080 },
      preferredSide: 'right',
      expectedPosition: { top: 430, right: 1070, bottom: 530, left: 770 },
      expectedSide: 'left',
    },
    {
      targetPosition: { top: 810, right: 690, bottom: 910, left: 590 },
      preferredSide: 'bottom',
      expectedPosition: { top: 700, right: 790, bottom: 800, left: 490 },
      expectedSide: 'top',
    },
    {
      targetPosition: { top: 430, right: 300, bottom: 530, left: 200 },
      preferredSide: 'left',
      expectedPosition: { top: 430, right: 610, bottom: 530, left: 310 },
      expectedSide: 'right',
    },
  ] as { targetPosition: Position; preferredSide: Side; expectedPosition: Position; expectedSide: Side }[])(
    'moves popup to opposite side if there is not enough space on preferred side',
    ({ targetPosition, preferredSide, expectedPosition, expectedSide }) => {
      // Arrange
      const elementSize: Size = { width: 300, height: 100 };
      const viewportSize: Size = {
        width: 1280,
        height: 960,
      };
      const gap = 10;

      // Act
      const popup = computePopupPosition({
        elementSize,
        gap,
        preferredSide,
        targetPosition,
        viewportSize,
      });

      // Assert
      expect(popup.position).toEqual(expectedPosition);
      expect(popup.side).toBe(expectedSide);
    }
  );
});

describe('useBoundingRects', () => {
  beforeAll(() => {
    // JSDOM's getBoundingClientRect always returns all zeroes.
    jest.spyOn(window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      // @ts-ignore
      // eslint-disable-next-line
      const self: HTMLElement = this;

      const width = parseFloat(self.style.width) || 0;
      const height = parseFloat(self.style.height) || 0;
      const top = parseFloat(self.style.marginTop) || 0;
      const left = parseFloat(self.style.marginLeft) || 0;

      return {
        x: left,
        y: top,
        width,
        height,
        top,
        right: left + width,
        bottom: top + height,
        left,
      } as DOMRect;
    });
  });

  it('returns bounding rect for elements selected by ref', () => {
    // Arrange
    const receivedBoundingRect = jest.fn();

    const TestComponent = () => {
      const ref = useRef<HTMLDivElement>(null);

      const [boundingRect] = useBoundingRects([{ ref }]);
      receivedBoundingRect(boundingRect);

      return <div ref={ref} style={{ width: 200, height: 100, margin: '100px 0 0 50px' }} />;
    };

    // Act
    render(<TestComponent />);

    // Assert
    expect(receivedBoundingRect).toHaveBeenCalledWith({
      width: 200,
      height: 100,
      top: 100,
      right: 250,
      bottom: 200,
      left: 50,
    });
  });

  it('returns bounding rect for elements selected by ID', () => {
    // Arrange
    const receivedBoundingRect = jest.fn();

    const TestComponent = () => {
      const [boundingRect] = useBoundingRects([{ id: 'test-element' }]);
      receivedBoundingRect(boundingRect);

      return <div id='test-element' style={{ width: 200, height: 100, margin: '100px 0 0 50px' }} />;
    };

    // Act
    render(<TestComponent />);

    // Assert
    expect(receivedBoundingRect).toHaveBeenCalledWith({
      width: 200,
      height: 100,
      top: 100,
      right: 250,
      bottom: 200,
      left: 50,
    });
  });

  it('returns bounding rect for the window', () => {
    // Arrange
    const receivedBoundingRect = jest.fn();

    const TestComponent = () => {
      const [boundingRect] = useBoundingRects([{ viewport: true }]);
      receivedBoundingRect(boundingRect);

      return null;
    };

    // Act
    render(<TestComponent />);

    // Assert
    expect(receivedBoundingRect).toHaveBeenCalledWith({
      width: 1024,
      height: 768,
      top: 0,
      right: 1024,
      bottom: 768,
      left: 0,
    });
  });
});
