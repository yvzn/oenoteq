export default {
  cellar: {
    list: {
      title: 'Cellar',
      count: '{count} wine in cellar | {count} wines in cellar',
      add: 'Add wine',
      loading: 'Loading your cellar…',
      loadError: "Couldn't load your cellar: {error}",
      empty: 'No wines match these filters.',
      unknownAppellation: 'Unknown appellation',
      noMillesime: 'NV',
      columns: { quantity: 'Qty', status: 'Status' },
    },
    filters: {
      title: 'Filters',
      titleWithCount: 'Filters ({count})',
      close: 'Close filters',
      anyMeal: 'Any meal',
      anyAppellation: 'Any appellation',
      color: 'Color',
      anyColor: 'Any color',
      readyNow: 'Ready now',
      clear: 'Clear filters',
    },
    sort: {
      title: 'Sort',
      close: 'Close sort',
      ascending: '↑ Ascending',
      descending: '↓ Descending',
      status: 'Status',
    },
    firstVisit: {
      message: 'Your cellar needs one connected visit before it can be shown offline. Connect once to download it.',
      link: 'Open the sync page',
    },
    pagination: {
      label: 'Cellar pages',
      previous: 'Previous',
      next: 'Next',
      status: 'Page {page} of {pageCount}',
    },
  },
}
