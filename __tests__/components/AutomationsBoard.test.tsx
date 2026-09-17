/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AutomationEvent } from '@/src/core/shared/types/automations';
import AutomationsBoard from '../../components/automations/AutomationsBoard';

const ev = (id: number, date: string, over: Partial<AutomationEvent> = {}): AutomationEvent => ({
  id, domainId: 1, workspaceId: 1, scheduledDate: date, title: `Post ${id}`, targetKeyword: 'kw',
  publishMode: 'draft', articleId: null, status: 'scheduled', createdAt: null, ...over,
});

const events = [
  ev(1, '2024-12-16', { title: 'Figma basics', status: 'created', articleId: 11 }),
  ev(2, '2024-12-16', { title: 'Local SEO', status: 'published', publishMode: 'live', articleId: 12 }),
  ev(3, '2024-12-18', { title: 'Boolean types', status: 'failed', publishMode: 'live' }),
];

const setup = (over: Partial<React.ComponentProps<typeof AutomationsBoard>> = {}) => {
  const props = {
    windowStart: new Date(2024, 11, 16),
    events,
    onPrevDays: jest.fn(),
    onNextDays: jest.fn(),
    onToday: jest.fn(),
    onAdd: jest.fn(),
    onDayAdd: jest.fn(),
    onEventClick: jest.fn(),
    onEventDelete: jest.fn(),
    ...over,
  };
  render(<AutomationsBoard {...props} />);
  return props;
};

it('renders four day columns from the window start, with counts and the result line', () => {
  setup();
  expect(screen.getByRole('button', { name: '16 - 19 December 2024' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Monday, 16 Dec 2024' })).toHaveTextContent('2');
  expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
    'Monday, 16 Dec 2024', 'Tuesday, 17 Dec 2024', 'Wednesday, 18 Dec 2024', 'Thursday, 19 Dec 2024',
  ]);
  expect(screen.getByText('3 Result')).toBeInTheDocument();
});

it('shows each card with its status tag and publish intent', () => {
  setup();
  const monday = screen.getByRole('region', { name: 'Monday, 16 Dec 2024' });
  expect(within(monday).getByText('Draft ready')).toBeInTheDocument();
  expect(within(monday).getByText('Published')).toBeInTheDocument();
  expect(within(monday).getByText('Keep as draft')).toBeInTheDocument();
  expect(screen.getAllByText('Publish live')).toHaveLength(2);
});

it('offers an empty day for scheduling', () => {
  const props = setup();
  const tuesday = screen.getByRole('region', { name: 'Tuesday, 17 Dec 2024' });
  fireEvent.click(tuesday.querySelector('button') as HTMLButtonElement);
  expect(props.onDayAdd).toHaveBeenCalledWith(new Date(2024, 11, 17));
});

it('filters by status, shows a clearable chip, and restores on clear', () => {
  setup();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } });
  expect(screen.getByText('1 Result')).toBeInTheDocument();
  expect(screen.queryByText('Figma basics')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear Status' }));
  expect(screen.getByText('3 Result')).toBeInTheDocument();
});

it('opens the article for a card that has one and removes via the hover action', () => {
  const props = setup();
  fireEvent.click(screen.getByText('Figma basics'));
  expect(props.onEventClick).toHaveBeenCalledWith(events[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Local SEO' }));
  expect(props.onEventDelete).toHaveBeenCalledWith(events[1]);
  expect(props.onEventClick).toHaveBeenCalledTimes(1); // delete does not open the article
});

it('routes the pager and Add event buttons', () => {
  const props = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Previous days' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next days' }));
  fireEvent.click(screen.getByRole('button', { name: '16 - 19 December 2024' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
  expect(props.onPrevDays).toHaveBeenCalled();
  expect(props.onNextDays).toHaveBeenCalled();
  expect(props.onToday).toHaveBeenCalled();
  expect(props.onAdd).toHaveBeenCalled();
});
