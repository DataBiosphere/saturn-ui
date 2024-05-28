import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import {
  AboutPersistentDiskSection,
  AboutPersistentDiskSectionProps,
} from 'src/analysis/modals/ComputeModal/AboutPersistentDiskSection';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

const defaultAboutPersistentDiskSectionProps: AboutPersistentDiskSectionProps = {
  onClick: jest.fn(),
};

describe('AboutPersistentDiskSection', () => {
  it('should render with default props', () => {
    // Arrange
    render(h(AboutPersistentDiskSection, defaultAboutPersistentDiskSectionProps));
    // Assert
    expect(screen.getByText('Persistent disk')).toBeTruthy();
    expect(screen.getByText('Learn more about persistent disks and where your disk is mounted.')).toBeTruthy();
  });

  it('should call setViewMode when clicked', async () => {
    // Arrange
    render(h(AboutPersistentDiskSection, defaultAboutPersistentDiskSectionProps));
    await userEvent.click(screen.getByText('Learn more about persistent disks and where your disk is mounted.'));

    // Assert
    expect(defaultAboutPersistentDiskSectionProps.onClick).toBeCalled();
  });
});
