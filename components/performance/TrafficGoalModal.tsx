import { Button, Input, Modal, ModalBody, ModalFooter, Select } from '../core';
import type { GoalPeriod, TrafficGoal } from '../../lib/performance/types';
import GoalProjectionChart from './GoalProjectionChart';

type TrafficGoalModalProps = {
  onClose: () => void;
  goalPercentage: number;
  onGoalPercentageChange: (value: number) => void;
  goalPeriod: GoalPeriod;
  onGoalPeriodChange: (value: GoalPeriod) => void;
  currentClicks: string;
  trafficGoal: TrafficGoal | null;
  onDeleteGoal: () => void;
  onSaveGoal: () => void;
  goalSaving: boolean;
};

export default function TrafficGoalModal({
  onClose,
  goalPercentage,
  onGoalPercentageChange,
  goalPeriod,
  onGoalPeriodChange,
  currentClicks,
  trafficGoal,
  onDeleteGoal,
  onSaveGoal,
  goalSaving,
}: TrafficGoalModalProps) {
  return (
    <Modal title="Create clicks goal" onClose={onClose} width={600}>
      <ModalBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'inherit' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 12, background: '#F8F8F9', padding: 16, flexWrap: 'wrap', fontSize: 14, color: '#3F3F47' }}>
            <span>Increase clicks by</span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Input size="sm" type="number" min={1} max={999} value={goalPercentage}
                onChange={(e) => onGoalPercentageChange(Math.max(1, Math.min(999, Number(e.target.value))))}
                style={{ width: 80, paddingRight: 24 }} />
              <span style={{ position: 'absolute', right: 8, color: '#52525C', fontSize: 14, pointerEvents: 'none' }}>%</span>
            </div>
            <span>each</span>
            <Select size="sm" value={goalPeriod} onChange={(v) => onGoalPeriodChange(v as GoalPeriod)} width={120}
              options={[{ value: 'MONTH', label: 'month' }, { value: 'QUARTER', label: 'quarter' }]} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#18181B' }}>Projected growth</h3>
            <GoalProjectionChart baseClicks={parseInt(String(currentClicks).replace(/[^0-9]/g, ''), 10) || 0} percentage={goalPercentage} period={goalPeriod} />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        {trafficGoal ? (
          <Button variant="link" size="sm" onClick={onDeleteGoal} style={{ color: '#FF6F77', padding: 0, marginRight: 'auto' }}>Delete goal</Button>
        ) : <div style={{ flex: 1 }} />}
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={onSaveGoal} busy={goalSaving} disabled={goalSaving}>
          {goalSaving ? 'Saving...' : 'Create goal'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
