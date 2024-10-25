import { Theme, ThemeProvider } from '@terra-ui-packages/components';
import {
  makeNotificationsProvider,
  NotificationsContextProvider,
  NotificationsProvider,
  Notifier,
} from '@terra-ui-packages/notifications';
import {
  act,
  render,
  renderHook,
  RenderHookOptions,
  RenderHookResult,
  RenderOptions,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropsWithChildren, ReactElement } from 'react';
import { h } from 'react-hyperscript-helpers';

export { asMockedFn, type MockedFn, partial } from '@terra-ui-packages/test-utils';

const testTheme: Theme = {
  colorPalette: {
    primary: '#74ae43',
    secondary: '#6d6e70',
    accent: '#4d72aa',
    success: '#74ae43',
    warning: '#f7981c',
    danger: '#db3214',
    light: '#e9ecef',
    dark: '#333f52',
    grey: '#808080',
    disabled: '#b6b7b8',
  },
};

const mockNotifier: Notifier = {
  notify: jest.fn(),
};

export const mockNotifications: NotificationsProvider = makeNotificationsProvider({
  notifier: mockNotifier,
  shouldIgnoreError: () => false,
});

const AppProviders = ({ children }: PropsWithChildren<{}>): ReactElement => {
  return h(ThemeProvider, { theme: testTheme }, [
    h(NotificationsContextProvider, { notifications: mockNotifications }, [children]),
  ]);
};

export const renderWithAppContexts = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  return render(ui, { wrapper: AppProviders, ...options });
};

type UserEvent = ReturnType<typeof userEvent.setup>;

export const renderHookWithAppContexts = <T, U>(
  hook: (args: T) => U,
  options?: RenderHookOptions<T>
): RenderHookResult<U, T> => {
  const baseOptions: RenderHookOptions<T> = {
    wrapper: AppProviders,
  };
  const mergedOptions: RenderHookOptions<T> = { ...baseOptions, ...options };
  return renderHook(hook, mergedOptions);
};

// This is for the AutoSizer component. It requires screen dimensions in order to be tested properly.
export const setUpAutoSizerTesting = () => {
  Object.defineProperties(window.HTMLElement.prototype, {
    offsetLeft: {
      get() {
        return parseFloat(window.getComputedStyle(this).marginLeft) || 0;
      },
    },
    offsetTop: {
      get() {
        return parseFloat(window.getComputedStyle(this).marginTop) || 0;
      },
    },
    offsetHeight: {
      get() {
        return parseFloat(window.getComputedStyle(this).height) || 0;
      },
    },
    offsetWidth: {
      get() {
        return parseFloat(window.getComputedStyle(this).width) || 0;
      },
    },
  });
};

const renderHookInActInternal = async <T, U>(
  renderer: typeof renderHook<U, T>,
  hook: (args: T) => U,
  options?: RenderHookOptions<T>
): Promise<RenderHookResult<U, T>> => {
  let result: RenderHookResult<U, T>;
  await act(async () => {
    result = renderer(hook, options);
  });
  return result!;
};

export const renderHookInAct = async <T, U>(
  hook: (args: T) => U,
  options?: RenderHookOptions<T>
): Promise<RenderHookResult<U, T>> => {
  return renderHookInActInternal(renderHook, hook, options);
};

export const renderHookInActWithAppContexts = async <T, U>(
  hook: (args: T) => U,
  options?: RenderHookOptions<T>
): Promise<RenderHookResult<U, T>> => {
  return renderHookInActInternal(renderHookWithAppContexts, hook, options);
};

export class SelectHelper {
  inputElement: HTMLElement;

  user: UserEvent;

  constructor(inputElement: HTMLElement, user: UserEvent) {
    this.inputElement = inputElement;
    this.user = user;
  }

  async openMenu(): Promise<void> {
    const expanded = this.inputElement.getAttribute('aria-expanded');
    if (expanded === 'false') {
      await this.user.click(this.inputElement);
    }
  }

  async closeMenu(): Promise<void> {
    const expanded = this.inputElement.getAttribute('aria-expanded');
    if (expanded === 'true') {
      this.inputElement.focus();
      await this.user.keyboard('{Escape}');
    }
  }

  async getOptions(excludeDisabled = false): Promise<string[]> {
    await this.openMenu();
    const listboxId = this.inputElement.getAttribute('aria-controls')!;
    const listBox = document.getElementById(listboxId)!;
    let selector = '[role="option"]';
    if (excludeDisabled) {
      selector += '[aria-disabled="false"]';
    }
    const options = Array.from(listBox.querySelectorAll(selector));
    const optionLabels = options.map((opt) => opt.textContent!);
    await this.closeMenu();
    return optionLabels;
  }

  async selectOption(optionLabel: string | RegExp): Promise<void> {
    await this.openMenu();
    const listboxId = this.inputElement.getAttribute('aria-controls')!;
    const listBox = document.getElementById(listboxId)!;
    const option = within(listBox).getByRole('option', { name: optionLabel });
    await this.user.click(option);
  }

  getSelectedOptions(): string[] {
    // Searchable Select components have an additional wrapper element
    const valueContainer = this.inputElement.getAttribute('aria-readonly')
      ? this.inputElement.parentElement
      : this.inputElement.parentElement?.parentElement;
    const values = Array.from(valueContainer!.querySelectorAll(':scope > div[class*="Value"]'));
    return values.map((valueElement) => valueElement.textContent ?? '');
  }
}
