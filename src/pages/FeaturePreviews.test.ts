import { fireEvent, getByText } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { isFeaturePreviewEnabled, toggleFeaturePreview, useAvailableFeaturePreviews } from 'src/libs/feature-previews';
import { FeaturePreviews } from 'src/pages/FeaturePreviews';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/feature-previews');

describe('FeaturePreviews', () => {
  beforeEach(() => {
    asMockedFn(useAvailableFeaturePreviews).mockReturnValue({
      featurePreviews: [
        // @ts-expect-error
        {
          id: 'feature1',
          title: 'Feature #1',
          description: 'A new feature',
          documentationUrl: 'https://example.com/feature-1-docs',
          lastUpdated: '2024-11-01',
        },
        // @ts-expect-error
        {
          id: 'feature2',
          title: 'Feature #2',
          description: 'Another new feature',
          feedbackUrl: 'mailto:feature2-feedback@example.com',
          lastUpdated: '2024-11-02',
        },
      ],
      loading: false,
    });

    asMockedFn(isFeaturePreviewEnabled).mockReturnValue(false);
  });

  it('should render available feature previews', () => {
    const { getAllByRole } = render(h(FeaturePreviews));
    const cells = getAllByRole('cell');

    expect(getByText(cells[1], 'Feature #1')).toBeTruthy();
    expect(getByText(cells[1], 'A new feature')).toBeTruthy();
    expect(getByText(cells[2], 'Nov 1, 2024')).toBeTruthy();

    expect(getByText(cells[4], 'Feature #2')).toBeTruthy();
    expect(getByText(cells[4], 'Another new feature')).toBeTruthy();
    expect(getByText(cells[5], 'Nov 2, 2024')).toBeTruthy();
  });

  it('should render whether features are enabled', () => {
    asMockedFn(isFeaturePreviewEnabled).mockImplementation((id) => id === 'feature1');

    const { getAllByRole } = render(h(FeaturePreviews));
    const checkboxes = getAllByRole('switch');

    expect(checkboxes[1].hasAttribute('checked')).toBe(true);
    expect(checkboxes[2].hasAttribute('checked')).toBe(false);
  });

  it('checking a checkbox should toggle feature previews', () => {
    const { getAllByRole } = render(h(FeaturePreviews));
    const checkboxes = getAllByRole('switch');

    fireEvent.click(checkboxes[0]);
    expect(toggleFeaturePreview).toHaveBeenCalledWith('feature1', true);

    fireEvent.click(checkboxes[0]);
    expect(toggleFeaturePreview).toHaveBeenCalledWith('feature1', false);
  });

  it('should (de)select all feature previews when "Select All" toggle is clicked', () => {
    const { getByTitle } = render(h(FeaturePreviews));
    const selectAllButton = getByTitle('Select All');

    fireEvent.click(selectAllButton);

    expect(toggleFeaturePreview).toHaveBeenCalledWith('feature1', true);
    expect(toggleFeaturePreview).toHaveBeenCalledWith('feature2', true);

    fireEvent.click(selectAllButton);

    expect(toggleFeaturePreview).toHaveBeenCalledWith('feature1', false);
    expect(toggleFeaturePreview).toHaveBeenCalledWith('feature2', false);
  });

  it('should render documentation link if provided', () => {
    const { getAllByText } = render(h(FeaturePreviews));
    const docLinks = getAllByText('Documentation');
    expect(docLinks.length).toBe(1);
    expect(docLinks[0].getAttribute('href')).toBe('https://example.com/feature-1-docs');
  });

  it('should render feedback link if provided', () => {
    const { getAllByText } = render(h(FeaturePreviews));
    const feedbackLinks = getAllByText('Learn more and provide feedback');
    expect(feedbackLinks.length).toBe(1);
    expect(feedbackLinks[0].getAttribute('href')).toBe('mailto:feature2-feedback@example.com');
  });

  it('should render "Go to Workspaces List" link', () => {
    const { getByRole } = render(h(FeaturePreviews));
    const link = getByRole('link', { name: 'Go to Workspaces List' });

    expect(link).toBeTruthy();
    expect(link).toHaveAttribute('href', '#workspaces');
  });
});
