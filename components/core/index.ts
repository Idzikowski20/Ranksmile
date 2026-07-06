export { default as Badge } from './badge/badge';
export { default as Button } from './button/button';
export { default as Checkbox } from './checkbox/checkbox';
export { default as Switch } from './switch/switch';
export { default as Tabs } from './tabs/tabs';
export { default as Skeleton } from './loader/indeterminateLoader';
export { default as Tooltip } from './tooltip/tooltip';
export { default as Input } from './input/input';
export { default as Modal, ModalHeader, ModalBody, ModalFooter } from './modal/modal';
export { default as SlideOverPanel } from './slideOverPanel/slideOverPanel';
export { default as Select } from './select/select';
export { DateRangePicker } from './calendar/dateRangePicker';
export { theme } from './theme';
export { IconDefaultsProvider } from './IconDefaultsProvider';

// ── Layout primitives (Sentry-style) ────────────────────────────────────────
export {Container, Flex, Grid, Stack} from './layout';
export type {ContainerProps, FlexProps, GridProps, StackProps} from './layout';

// ── Typography primitives (Sentry-style) ─────────────────────────────────────
export {Text, Heading} from './text';
export type {TextProps, HeadingProps} from './text';

// Backward-compat aliases
export { Switch as Toggle } from './switch/switch';
export { default as HoverTooltip } from '../common/HoverTooltip';

// KEEP_UNIQUE — re-exported for unified imports
export { default as Gauge } from '../ui/Gauge';
export { default as SelectionBar } from '../ui/SelectionBar';
export { default as SortableHeader } from '../ui/SortableHeader';
export { default as SearchBar } from '../ui/SearchBar';
export { default as SlidePanel } from '../ui/SlidePanel';
export * from '../ui/icons';
export * from '../ui/tokens';
