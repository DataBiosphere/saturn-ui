import { Clickable } from './Clickable';
import { renderWithTheme as render } from './internal/test-utils';
import { Link } from './Link';

type ClickableExports = typeof import('./Clickable');
jest.mock('./Clickable', (): ClickableExports => {
  return {
    ...jest.requireActual<ClickableExports>('./Clickable'),
    // @ts-expect-error
    // TS expects this to have additional fields because it's a ForwardRefExoticComponent,
    // but an ordinary function component works for this test.
    Clickable: jest.fn().mockReturnValue(null),
  };
});

describe('Link', () => {
  it('renders a styled Clickable', () => {
    // Act
    render(<Link href='https://example.com' />);

    // Assert
    expect(Clickable).toHaveBeenCalledWith(
      expect.objectContaining({ style: expect.anything(), hover: expect.anything() }),
      expect.anything()
    );
  });

  it('has a light variant that is styled differently', () => {
    // Act
    render(<Link href='https://example.com' />);
    const defaultStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

    render(<Link href='https://example.com' variant='light' />);
    const lightVariantStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

    // Assert
    expect(lightVariantStyle).not.toEqual(defaultStyle);
  });

  it('can be styled with a different base color', () => {
    // Act
    render(<Link href='https://example.com' />);
    const defaultStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

    render(<Link href='https://example.com' baseColor={() => 'blue'} />);
    const baseColorStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

    // Assert
    expect(baseColorStyle).not.toEqual(defaultStyle);
  });

  describe('when disabled', () => {
    it('is styled differently', () => {
      // Act
      render(<Link href='https://example.com' />);
      const enabledStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

      render(<Link href='https://example.com' disabled />);
      const disabledStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

      // Assert
      expect(disabledStyle).not.toEqual(enabledStyle);
    });

    it('has no hover style', () => {
      // Act
      render(<Link href='https://example.com' disabled />);
      const disabledHoverStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].hover;

      // Assert
      expect(disabledHoverStyle).toBe(undefined);
    });
  });
});
