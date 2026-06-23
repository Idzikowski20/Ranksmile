import React from 'react';
import Gauge from '../ui/Gauge';

interface Props { score: number; compact?: boolean; }

const ScoreGauge = ({ score, compact }: Props) => (
  <Gauge score={score} size={compact ? 'md' : 'lg'} />
);

export default ScoreGauge;
