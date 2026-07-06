import React from 'react';
import { Tooltip } from '../core/tooltip/tooltip';

const HoverTooltip = ({ label, align = 'left', children }: { label: string; align?: 'left' | 'right' | 'center'; children: React.ReactNode }) => (
  <Tooltip title={label} disabled={!label}>
    {children}
  </Tooltip>
);

export default HoverTooltip;
