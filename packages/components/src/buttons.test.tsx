import { ButtonOutline, ButtonPrimary, ButtonSecondary } from './buttons';
import { Clickable } from './Clickable';
import { renderWithTheme as render } from './internal/test-utils';

type ClickableExports = typeof import('./Clickable');
jest.mock('./Clickable', (): ClickableExports => {
  return {
    ...jest.requireActual<ClickableExports>('./Clickable'),
    // @ts-expect-error
    // TS expects this to have additional fields because Clickable is a ForwardRefExoticComponent,
    // but an ordinary function component works for this test.
    Clickable: jest.fn().mockReturnValue(null),
  };
});

describe.each([{ component: ButtonPrimary }, { component: ButtonSecondary }, { component: ButtonOutline }])(
  '$component.name',
  ({ component: ButtonComponent }) => {
    it('renders a styled Clickable', () => {
      // Act
      render(<ButtonComponent />);

      // Assert
      expect(Clickable).toHaveBeenCalledWith(
        expect.objectContaining({ style: expect.anything(), hover: expect.anything() }),
        expect.anything()
      );
    });

    describe('when disabled', () => {
      it('is styled differently', () => {
        // Act
        render(<ButtonComponent />);
        const enabledStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

        render(<ButtonComponent disabled />);
        const disabledStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

        // Assert
        expect(disabledStyle).not.toEqual(enabledStyle);
      });

      it('has no hover style', () => {
        // Act
        render(<ButtonComponent disabled />);
        const disabledHoverStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].hover;

        // Assert
        expect(disabledHoverStyle).toBe(undefined);
      });
    });
  }
);

describe('ButtonPrimary', () => {
  it('can be styled differently to indicate a dangerous action', () => {
    // Act
    render(<ButtonPrimary />);
    const defaultStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

    render(<ButtonPrimary danger />);
    const dangerStyle = (Clickable as jest.MockedFunction<typeof Clickable>).mock.lastCall[0].style;

    // Assert
    expect(dangerStyle).not.toEqual(defaultStyle);
  });
});
