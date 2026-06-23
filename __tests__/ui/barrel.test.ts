import * as ui from '../../components/ui';

it('barrel eksportuje wszystkie publiczne komponenty', () => {
  ['Gauge', 'Checkbox', 'Toggle', 'SearchBar', 'Tabs', 'Badge',
   'Modal', 'SlidePanel', 'SelectionBar', 'Skeleton', 'SortableHeader'
  ].forEach((name) => {
    expect((ui as Record<string, unknown>)[name]).toBeDefined();
  });
});
