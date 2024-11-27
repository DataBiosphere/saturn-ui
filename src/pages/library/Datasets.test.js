import { h } from 'react-hyperscript-helpers';
import { prepareDatasetsForDisplay } from 'src/data-catalog/data-browser-utils';
import { brands } from 'src/libs/brands';
import * as Nav from 'src/libs/nav';
import { dataCatalogStore } from 'src/libs/state';
import { Datasets } from 'src/pages/library/Datasets';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/Metrics');

jest.mock('src/libs/brand-utils', () => {
  const { brands } = jest.requireActual('src/libs/brands');
  return {
    ...jest.requireActual('src/libs/brand-utils'),
    getEnabledBrand: jest.fn().mockReturnValue(brands.terra),
  };
});

jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn(),
  useRoute: jest.fn(),
}));

beforeEach(() => {
  dataCatalogStore.reset();
  Nav.useRoute.mockReturnValue({ title: 'Data Browser', params: {}, query: {} });
});

describe('Dataset Browser', () => {
  it('shows a toggle for the data catalog', () => {
    const { getByLabelText, getByText } = render(h(Datasets));
    expect(getByText('Preview the new Data Catalog')).toBeTruthy();
    expect(getByLabelText('New Catalog OFF')).toBeTruthy();
  });

  it('shows all datasets in terra', () => {
    expect(
      prepareDatasetsForDisplay(
        [
          { 'dct:title': 'catalog-test-included', 'TerraDCAT_ap:hasDataCollection': [{ 'dct:title': 'catalog-test-included' }] },
          { 'dct:title': 'not-included' },
        ],
        brands.terra.catalogDataCollectionsToInclude
      ).length
    ).toBe(2);
  });
});
