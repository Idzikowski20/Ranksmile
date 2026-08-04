import type { ComponentProps } from 'react';
import { Checkbox as CoreCheckbox } from '../core/checkbox/checkbox';

/** @deprecated Import Checkbox from `components/koala/core` — this re-exports the SSOT. */
export { Checkbox as default, Checkbox } from '../core/checkbox/checkbox';
export type CheckboxProps = ComponentProps<typeof CoreCheckbox>;
