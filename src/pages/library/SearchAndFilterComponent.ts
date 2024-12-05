import { Modal, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import pluralize from 'pluralize';
import * as qs from 'qs';
import React, { CSSProperties, Fragment, ReactElement, useState } from 'react';
import { div, em, h, h2, label, span, strong } from 'react-hyperscript-helpers';
import Collapse from 'src/components/Collapse';
import { ButtonPrimary, Clickable, IdContainer, LabeledCheckbox, Link, Select } from 'src/components/common';
import { icon } from 'src/components/icons';
import { DelayedAutoCompleteInput, DelayedSearchInput } from 'src/components/input';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import Events from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import * as Utils from 'src/libs/utils';

export interface FilterSection<DataType> {
  header: string;
  matchBy: (listItem: DataType, value: string) => boolean;
  renderer?: (string) => string | ReactElement;
  values: string[];
}

export const commonStyles = {
  access: {
    granted: colors.success(1.5),
    controlled: colors.accent(),
    pending: '#F7981C',
  },
};

const styles = {
  header: {
    fontSize: '1.5rem',
    color: colors.dark(),
    fontWeight: 700,
  },
  sidebarRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    margin: 0,
  },
  nav: {
    navSection: {
      alignItems: 'center',
      flex: 'none',
      padding: '0.5rem 0',
    },
    title: { borderBottom: `1px solid ${colors.dark(0.3)}`, paddingBottom: '0.75rem', marginBottom: '1rem' },
  },
  pill: (highlight: boolean): CSSProperties => ({
    width: '4.5rem',
    padding: '0.25rem',
    fontWeight: 500,
    textAlign: 'center',
    border: '1px solid',
    borderColor: colors.dark(0.25),
    borderRadius: '1rem',
    fontSize: '0.875rem',
    backgroundColor: 'white',
    ...(highlight
      ? { color: 'white', backgroundColor: colors.primary(1.5), borderColor: colors.primary(1.5), fontWeight: 'bold' }
      : {}),
  }),
};

const numLabelsToRender = 5;

const FILTER_BY_COUNT = 'FILTER_BY_COUNT';

interface FilterBarProps<ListItem> {
  section: FilterSection<ListItem>;
  onFilter: Function;
  valuesFilter: string;
  onSearch: Function;
  searchTerm: string;
}
const FilterBar = <ListItem>({ section, onFilter, valuesFilter, onSearch, searchTerm }: FilterBarProps<ListItem>) => {
  const filterMode = { filter: 1, search: 2 };
  const [filterType, setFilterType] = useState(filterMode.filter);

  return h(Fragment, [
    filterType === filterMode.filter &&
      div(
        {
          style: {
            backgroundColor: colors.dark(0.1),
            paddingTop: 6,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        },
        [
          h(
            Link,
            {
              style: {
                marginLeft: 20,
                padding: 5,
                borderRadius: 10,
                fontWeight: 'bold',
                fontSize: '1rem',
                textTransform: 'capitalize',
                background: valuesFilter === FILTER_BY_COUNT ? colors.accent(0.3) : 'transparent',
              },
              onClick: () => {
                onFilter(FILTER_BY_COUNT);
              },
            },
            [`Top ${pluralize(section.header)}`]
          ),
          div(
            {
              style: {
                width: '100%',
                maxWidth: 600,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-around',
                fontSize: '1rem',
              },
            },
            _.map(
              (index) =>
                h(
                  Link,
                  {
                    style: {
                      fontWeight: 'bold',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: 5,
                      borderRadius: '50%',
                      minWidth: 20,
                      background: valuesFilter === String.fromCharCode(index) ? colors.accent(0.3) : 'transparent',
                    },
                    'aria-label':
                      valuesFilter === String.fromCharCode(index)
                        ? `Filtering by ${String.fromCharCode(index)}`
                        : `Filter option: ${String.fromCharCode(index)}`,
                    onClick: () => {
                      const charFromCode = String.fromCharCode(index);
                      onFilter(charFromCode);
                    },
                  },
                  [String.fromCharCode(index)]
                ),
              _.range(65, 65 + 26)
            )
          ),
          h(
            Link,
            {
              onClick: () => {
                onFilter('');
                setFilterType(filterMode.search);
              },
              'aria-label': 'Search by text input',
            },
            [
              span({ className: 'fa-stack fa-2x' }, [
                icon('circle', {
                  size: 40,
                  className: 'fa-stack-2x',
                  style: { color: colors.primary(), opacity: 0.2 },
                }),
                icon('search', { size: 20, className: 'fa-stack-1x', style: { color: colors.primary() } }),
              ]),
            ]
          ),
        ]
      ),
    filterType === filterMode.filter &&
      valuesFilter &&
      div({ style: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5 } }, [
        h(
          Link,
          {
            style: { fontSize: '1rem' },
            onClick: () => onFilter(''),
          },
          ['Clear filter']
        ),
      ]),
    filterType === filterMode.search &&
      div({ style: { display: 'flex', alignItems: 'center', flexDirection: 'row' } }, [
        h(DelayedSearchInput, {
          style: {
            borderRadius: 25,
            borderColor: colors.dark(0.2),
            width: '100%',
            maxWidth: 575,
            height: '3rem',
            marginRight: 20,
          },
          value: searchTerm,
          'aria-label': `Search for ${section.header} filter options`,
          placeholder: 'Search keyword',
          icon: 'search',
          onChange: (searchText) => onSearch(searchText),
        }),
        h(
          Link,
          {
            style: { fontSize: '1rem' },
            onClick: () => {
              onSearch('');
              setFilterType(filterMode.filter);
            },
          },
          ['Close search']
        ),
      ]),
  ]);
};

interface FilterModalProps<ListItem> {
  section: FilterSection<ListItem>;
  setShowAll: Function;
  onFilterSelect: Function;
  selectedSections: FilterSection<ListItem>[];
  itemsFilteredByOtherSections: ListItem[];
}

const FilterModal = <ListItem>({
  section,
  setShowAll,
  onFilterSelect,
  selectedSections,
  itemsFilteredByOtherSections,
}: FilterModalProps<ListItem>) => {
  // Filter Modal Vars
  const [filterChanges, setFilterChanges] = useState([] as string[]);
  // Valid values are A-Z, '', or FILTER_BY_COUNT
  const [valuesFilter, setValuesFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const valuesToDisplay = Utils.switchCase(
    valuesFilter,
    ['', () => section.values],
    [
      FILTER_BY_COUNT,
      () =>
        _.orderBy(
          (sectionEntry) =>
            listItemsMatchForSectionEntry(sectionEntry, section.matchBy, itemsFilteredByOtherSections).length,
          'desc',
          section.values
        ),
    ],
    [Utils.DEFAULT, () => _.filter((sectionEntry) => _.isEqual(valuesFilter, sectionEntry.charAt(0)), section.values)]
  );

  return h(
    Modal,
    {
      title: div({ style: { fontSize: '1.325rem', fontWeight: 700 } }, [`Filter by: "${section.header}"`]),
      width: '100%',
      showButtons: true,
      styles: {
        modal: { maxWidth: 900, padding: 30 },
        buttonRow: { width: '100%', borderTop: `6px solid ${colors.dark(0.1)}`, paddingTop: 20 },
      },
      onDismiss: () => {
        setShowAll(false);
      },
      okButton: h(
        ButtonPrimary,
        {
          onClick: () => {
            setShowAll(false);
            onFilterSelect(filterChanges);
          },
        },
        ['Apply Filters']
      ),
    },
    [
      h(FilterBar as React.FC<FilterBarProps<ListItem>>, {
        section,
        onFilter: (valuesFilter) => setValuesFilter(valuesFilter),
        valuesFilter,
        onSearch: (searchTerm) => setSearchTerm(searchTerm),
        searchTerm,
      }),
      div({ style: { height: 'calc(80vh - 250px)', minHeight: 300, overflowY: 'auto' } }, [
        div(
          {
            style: {
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              fontSize: '1rem',
              marginTop: 20,
            },
          },
          _.map((sectionEntry) => {
            const numMatches = listItemsMatchForSectionEntry(
              sectionEntry,
              section.matchBy,
              itemsFilteredByOtherSections
            ).length;

            return div(
              {
                className: 'label',
                style: { width: '25%', margin: '0 15px 10px 30px', position: 'relative', minHeight: 30 },
              },
              [
                h(
                  LabeledCheckbox,
                  {
                    checked:
                      _.includes(sectionEntry, filterChanges) ||
                      sectionEntrySelected(section, sectionEntry, selectedSections),
                    onChange: () => {
                      setFilterChanges(_.xor(filterChanges, [sectionEntry]));
                    },
                    style: { position: 'absolute', left: -25, top: 2 },
                  },
                  [
                    div(
                      {
                        style: {
                          display: 'flex',
                          width: '100%',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          lineHeight: '1.4rem',
                        },
                      },
                      [
                        span([section.renderer ? section.renderer(sectionEntry) : sectionEntry]),
                        span({ style: { opacity: 0.5, fontSize: '.75rem', lineHeight: '1.4rem' } }, [
                          `(${numMatches})`,
                        ]),
                      ]
                    ),
                  ]
                ),
              ]
            );
          }, valuesToDisplay)
        ),
      ]),
    ]
  );
};

const reverseText = _.flow(_.reverse, _.join(''));

// truncateLeftWord
// This will behave like Lodash's _.truncate except it will truncate from the left side of the string.
// This function will also truncate at a word, so the beginning of the text is fully readable.
// Example: truncateLeftWord({length: 14}, 'this is my string') -> '...my string' - the ellipses are part of the string length
const truncateLeftWord = _.curry((options, text) =>
  _.flow(
    reverseText, // reverses the text so we can perform a truncate
    _.truncate(options),
    reverseText, // puts the text back in its original order
    _.replace(/\.\.\.(\S+)/, '...') // Removes the first partial word
  )(text)
);

const getContextualSuggestion = ([leftContext, match, rightContext]) => {
  return [
    strong([em(['Description: '])]),
    truncateLeftWord({ length: 40 }, leftContext),
    match,
    _.truncate({ length: 40 }, rightContext),
  ];
};

const sendSearchEvent = (term) => void Metrics().captureEvent(Events.catalogFilterSearch, { term });
const debounceSearchEvent = _.debounce(5000, sendSearchEvent);

/**
 * A function to get all data in a list for a specific filter item following the rules of the given matcher
 */
export const listItemsMatchForSectionEntry = <ListItem>(
  sectionEntry: string,
  matcher: (ListItem, string) => boolean,
  list: ListItem[]
): ListItem[] => _.filter((listItem) => matcher(listItem, sectionEntry), list);

/**
 * A function to get all data in a list for a filter section that returns the union of all data which matches any section entries
 */
export const getMatchingDataForSection = <ListItem>(section: FilterSection<ListItem>, list: ListItem[]) => {
  return _.flow(
    _.flatMap((sectionEntry: string) => listItemsMatchForSectionEntry(sectionEntry, section.matchBy, list)),
    _.uniqWith(_.isEqual)
  )(section.values);
};

/**
 * A function to get all data in a list that matches all given sections (intersection of matching data for each section)
 */
export const getMatchingDataForSectionList = <ListItem>(
  sections: FilterSection<ListItem>[],
  list: ListItem[]
): ListItem[] => {
  return sections.length === 0
    ? list
    : (_.flow(
        _.map((section: FilterSection<ListItem>) => getMatchingDataForSection(section, list)),
        _.over([_.first, _.tail]),
        _.spread(_.reduce(_.intersectionWith(_.isEqual)))
      )(sections) as unknown as ListItem[]);
};

export const sectionEntrySelected = <ListItem>(
  section: FilterSection<ListItem>,
  sectionEntry: string,
  selectedSections: FilterSection<ListItem>[]
): boolean =>
  _.filter((s) => _.isEqual(s.header, section.header) && _.includes(sectionEntry, s.values), selectedSections).length >
  0;

interface FilterSectionProps<ListItem> {
  section: FilterSection<ListItem>;
  fullList: ListItem[];
  selectedSections: FilterSection<ListItem>[];
  onFilterSelect: (arg0: string[]) => void;
}
const FilterSectionComponent = <ListItem>({
  section,
  fullList,
  selectedSections,
  onFilterSelect,
}: FilterSectionProps<ListItem>) => {
  const [showAll, setShowAll] = useState(false);
  // We only want to show the count when compared against other sections because filtered data is unioned within a section
  const selectedSectionsWithoutSection = _.remove(
    (s) => s.header === section.header,
    selectedSections
  ) as FilterSection<ListItem>[];
  const itemsFilteredByOtherSections = getMatchingDataForSectionList(selectedSectionsWithoutSection, fullList);
  // We want to filter out values for which there are no entries. This is only really important for values that are not derived from
  // the list data itself, like dataset access levels. However, because we don't differentiate between types of filters, we need to test all of them
  const labelsWithEntries = _.filter(
    (sectionEntry) => _.size(listItemsMatchForSectionEntry(sectionEntry, section.matchBy, fullList)) > 0,
    section.values
  );
  const selectedLabels = _.filter(
    (sectionEntry) => sectionEntrySelected(section, sectionEntry, selectedSections),
    section.values
  );
  // The shown labels are the first N labels that have any catalog entries, with any selected labels added at the end,
  // if they aren't one of the first N labels.
  const shownLabels = _.flow(
    _.intersection(labelsWithEntries),
    _.concat(_.take(numLabelsToRender, labelsWithEntries)),
    _.uniq
  )(selectedLabels);

  return h(Fragment, [
    _.map((sectionEntry: string) => {
      const numMatches = listItemsMatchForSectionEntry(
        sectionEntry,
        section.matchBy,
        itemsFilteredByOtherSections
      ).length;
      const sectionEntryChecked = _.includes(sectionEntry, selectedLabels);
      return h(
        Clickable,
        {
          'aria-checked': sectionEntryChecked,
          role: 'checkbox',
          key: _.uniqueId(''),
          style: {
            display: 'flex',
            alignItems: 'baseline',
            margin: '0.5rem 0',
            paddingBottom: '0.5rem',
            borderBottom: `1px solid ${colors.dark(0.1)}`,
          },
          onClick: () => onFilterSelect([sectionEntry]),
        },
        [
          div({ style: { lineHeight: '1.375rem', flex: 1 } }, [
            section.renderer ? section.renderer(sectionEntry) : sectionEntry,
          ]),
          div({ style: styles.pill(sectionEntryChecked) }, [numMatches, div({ className: 'sr-only' }, [' matches'])]),
        ]
      );
    }, shownLabels),
    // "See more" is shown if the shown labels aren't the same as all the possible labels.
    _.size(shownLabels) !== _.size(labelsWithEntries) &&
      h(
        Link,
        {
          style: { display: 'block', textAlign: 'center' },
          onClick: () => {
            setShowAll(!showAll);
          },
        },
        ['See more']
      ),
    showAll &&
      h(FilterModal as React.FC<FilterModalProps<ListItem>>, {
        section,
        setShowAll,
        onFilterSelect,
        selectedSections,
        itemsFilteredByOtherSections,
      }),
  ]);
};

const Sidebar = ({ onSectionFilter, sections, selectedSections, fullList }) => {
  return div({ style: { display: 'flex', flexDirection: 'column' } }, [
    _.map((section) => {
      const { header, values } = section;

      return h(
        Collapse,
        {
          key: header,
          style: styles.nav.navSection,
          summaryStyle: styles.nav.title,
          titleFirst: true,
          initialOpenState: true,
          title: h(Fragment, [
            span({ style: { fontWeight: 700 } }, [header]),
            span({ style: { marginLeft: '0.5rem', fontWeight: 400 } }, [`(${_.size(values)})`]),
          ]),
        },
        [
          h(FilterSectionComponent, {
            section,
            fullList,
            selectedSections,
            onFilterSelect: (sectionEntries) => onSectionFilter(section, sectionEntries),
          }),
        ]
      );
    }, sections),
  ]);
};

interface FilterSectionKeys {
  header: string;
  values: string[];
}

interface QueryParams {
  filter: string;
  selectedSections: FilterSectionKeys[];
}

type SortDirection = 'desc' | 'asc';

export interface Sort {
  field: string;
  direction: SortDirection;
}

const SortSelect = Select as typeof Select<Sort>;

export interface SearchAndFilterProps<ListItem> {
  fullList: ListItem[];
  sidebarSections: FilterSection<ListItem>[];
  customSort: Sort;
  searchType: string;
  getLowerName: Function;
  getLowerDescription: Function;
  titleField: string;
  descField: string;
  listView: Function;
}
export const SearchAndFilterComponent = <ListItem>({
  fullList,
  sidebarSections,
  customSort,
  searchType,
  getLowerName,
  getLowerDescription,
  titleField = 'name',
  descField = 'description',
  listView,
}: SearchAndFilterProps<ListItem>) => {
  const query = Nav.useRoute().query as QueryParams;
  const searchFilter = query.filter || '';
  const querySections: FilterSectionKeys[] = query.selectedSections || [];
  // Add the match and render functions to what is stored in the query params
  const selectedSections = _.map((section) => {
    const selectedSection = _.find((s) => s.header === section.header, sidebarSections) || {};
    return { ...selectedSection, ...section } as FilterSection<ListItem>;
  }, querySections);
  const [sort, setSort] = useState<Sort>({ field: 'created', direction: 'desc' });
  const filterRegex = new RegExp(`(${_.escapeRegExp(searchFilter)})`, 'i');
  const listItemsShown = _.filter(
    (item) => _.includes(_.toLower(searchFilter), `${getLowerName(item)} ${getLowerDescription(item)}`),
    getMatchingDataForSectionList(selectedSections, fullList)
  );
  const searchBarId = useUniqueId();

  const navigateToFilterAndSelection = ({ filter = searchFilter, sections = querySections } = {}) => {
    const newSearch = qs.stringify(
      {
        ...query,
        filter: filter || undefined,
        selectedSections: sections || undefined,
      },
      { addQueryPrefix: true }
    );

    if (newSearch !== Nav.history.location.search) {
      Nav.history.replace({ search: newSearch });
    }
  };

  const onSearchChange = (filter) => {
    if (filter) {
      // This method is already debounced, but we need to further debounce the event logging to
      // prevent getting all the intermediate filter strings in the event logs.
      debounceSearchEvent(filter);
    }

    navigateToFilterAndSelection({ filter });
  };

  // Trim items from the sidebar facets for which there aren't any search results
  const sections = _.remove((section) => _.isEmpty(getMatchingDataForSection(section, fullList)), sidebarSections);

  const getContext = _.flow(
    _.split(filterRegex),
    getContextualSuggestion,
    _.map((item) => (typeof item === 'string' && _.toLower(item) === _.toLower(searchFilter) ? strong([item]) : item))
  );

  return h(Fragment, [
    div(
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '19rem 1fr',
          gridTemplateRows: 'auto 3rem',
          gap: '2rem 1rem',
          gridAutoFlow: 'column',
          margin: '1rem 1rem 0',
          alignItems: 'baseline',
        },
      },
      [
        h2({ style: { ...styles.sidebarRow } }, [
          div({ style: styles.header }, [searchType]),
          div(
            {
              style: styles.pill(_.isEmpty(selectedSections)),
              role: 'status',
              'aria-label': `${_.size(listItemsShown)} Results found`,
            },
            [_.size(listItemsShown)]
          ),
        ]),
        div({ style: { ...styles.nav.title, display: 'flex', alignItems: 'baseline' } }, [
          div({ style: { flex: 1, fontSize: '1.125rem', fontWeight: 600 } }, ['Filters']),
          h(
            Link,
            {
              onClick: () => {
                navigateToFilterAndSelection({ sections: [] });
              },
            },
            ['clear']
          ),
        ]),
        div({ style: { display: 'flex', alignItems: 'center' } }, [
          h(Fragment, [
            div({ id: searchBarId, className: 'sr-only' }, [`Search ${searchType}`]),
            h(DelayedAutoCompleteInput, {
              style: { borderRadius: 25, flex: '1 1 0' } as CSSProperties,
              inputIcon: 'search',
              openOnFocus: true,
              value: searchFilter,
              labelId: searchBarId,
              placeholder: 'Search Name or Description',
              itemToString: (v) => v[titleField],
              onChange: onSearchChange,
              suggestionFilter: _.curry((needle, listItem) =>
                _.includes(_.toLower(needle), `${getLowerName(listItem)} ${getLowerDescription(listItem)}`)
              ),
              renderSuggestion: (suggestion) => {
                return div(
                  {
                    style: {
                      lineHeight: '1.75rem',
                      padding: '0.375rem 0',
                      borderBottom: `1px dotted ${colors.dark(0.7)}`,
                    },
                  },
                  _.flow(
                    _.split(filterRegex),
                    _.map((item) => (_.toLower(item) === _.toLower(searchFilter) ? strong([item]) : item)),
                    (maybeMatch) => {
                      // The size is only less than 2 (unsplit) if there are no matches in the title
                      return _.size(maybeMatch) < 2
                        ? [
                            // We can be confident that maybeMatch is a string because if it is a react element (strong) then it would need to have at least one match
                            _.truncate({ length: 90 }, _.head(maybeMatch) as string),
                            div({ style: { lineHeight: '1.5rem', marginLeft: '2rem' } }, [
                              ...getContext(suggestion[descField]),
                            ]),
                          ]
                        : maybeMatch;
                    }
                  )(suggestion[titleField] as string)
                );
              },
              suggestions: listItemsShown,
            }),
          ]),
          !customSort &&
            h(IdContainer, [
              (id) =>
                h(Fragment, [
                  label(
                    {
                      htmlFor: id,
                      style: { margin: '0 1ch 0 1rem', whiteSpace: 'nowrap' },
                    },
                    ['Sort by']
                  ),
                  h(SortSelect, {
                    id,
                    isClearable: false,
                    isSearchable: false,
                    styles: { container: (old) => ({ ...old, flex: '0 0 content' }) },
                    value: sort,
                    onChange: (opt) => setSort(opt!.value),
                    options: [
                      { value: { field: 'created', direction: 'desc' }, label: 'most recent' },
                      { value: { field: 'name', direction: 'asc' }, label: 'alphabetical' },
                    ],
                  }),
                ]),
            ]),
        ]),
        div({ style: { fontSize: '1rem', fontWeight: 600 } }, [
          searchFilter ? `Results For "${searchFilter}"` : 'All results',
        ]),
      ]
    ),
    div({ style: { display: 'flex', margin: '0 1rem', height: '100%' } }, [
      div({ style: { width: '19rem', flex: 'none' } }, [
        h(Sidebar, {
          onSectionFilter: (section, sectionEntries) => {
            const sectionSelected = _.findIndex((s) => _.isEqual(s.header, section.header), selectedSections);
            if (sectionSelected !== -1) {
              const sectionToAlter = selectedSections[sectionSelected];
              const valuesSelected = _.xor(sectionEntries, sectionToAlter.values);
              _.forEach(
                (sectionEntry) => void Metrics().captureEvent(Events.catalogFilterSidebar, { tag: sectionEntry }),
                sectionEntries
              );
              valuesSelected.length > 0
                ? navigateToFilterAndSelection({
                    sections: _.set(`[${sectionSelected}].values`, valuesSelected, selectedSections),
                  })
                : navigateToFilterAndSelection({
                    sections: _.remove((s) => _.isEqual(s.header, section.header), selectedSections),
                  });
            } else {
              const sections = _.concat({ ...section, values: sectionEntries }, selectedSections);
              navigateToFilterAndSelection({ sections });
            }
          },
          sections,
          selectedSections,
          fullList,
        }),
      ]),
      div({ style: { marginLeft: '1rem', minWidth: 0, width: '100%', height: '100%' } }, [
        _.isEmpty(listItemsShown)
          ? div({ style: { margin: 'auto', textAlign: 'center' } }, ['No Results Found'])
          : listView(listItemsShown),
      ]),
    ]),
  ]);
};
