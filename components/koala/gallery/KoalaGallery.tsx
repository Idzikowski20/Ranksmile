import React, { useState } from 'react';
import { Button } from '../core';
import { Card, CardHeader } from '../product/Card';
import { MetricWidget, ChartWidget, WidgetShell } from '../product/widgets';
import { Tooltip } from '../core/tooltip/tooltip';
import Modal, { ModalHeader, ModalBody } from '../primitives/Modal';
import Select from '../primitives/Select';
import Input from '../primitives/Input';

/**
 * Koala component gallery — Storybook-ready demos.
 * Route wrapper: pages/dev/koala-gallery.tsx only.
 */
export function KoalaGallery() {
  const [open, setOpen] = useState(false);
  const [select, setSelect] = useState('a');

  return (
    <div
      data-testid="koala-gallery"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        padding: 'var(--space-6)',
        maxWidth: 960,
        margin: '0 auto',
        fontFamily: 'var(--font-family-primary)',
        color: 'var(--koala-text-primary)',
        background: 'var(--koala-bg-primary)',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 'var(--font-size-2xl)' }}>Koala gallery</h1>

      <section data-testid="gallery-button">
        <h2 style={{ fontSize: 'var(--font-size-md)' }}>Button</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button type="button" variant="primary" size="sm">Primary</Button>
          <Button type="button" variant="secondary" size="sm">Secondary</Button>
          <Button type="button" variant="transparent" size="sm">Ghost</Button>
        </div>
      </section>

      <section data-testid="gallery-card">
        <h2 style={{ fontSize: 'var(--font-size-md)' }}>Card</h2>
        <Card>
          <CardHeader title="Card title" subtitle="Subtitle" />
          <p style={{ margin: 0, color: 'var(--koala-text-secondary)' }}>Card body</p>
        </Card>
      </section>

      <section data-testid="gallery-tooltip">
        <h2 style={{ fontSize: 'var(--font-size-md)' }}>Tooltip</h2>
        <Tooltip title="Tooltip content">
          <Button type="button" size="sm" variant="secondary">Hover me</Button>
        </Tooltip>
      </section>

      <section data-testid="gallery-dialog">
        <h2 style={{ fontSize: 'var(--font-size-md)' }}>Dialog</h2>
        <Button type="button" size="sm" variant="primary" onClick={() => setOpen(true)}>Open dialog</Button>
        <Modal open={open} onClose={() => setOpen(false)} aria-label="Dialog">
          <ModalHeader>Dialog</ModalHeader>
          <ModalBody>
            <p style={{ margin: 0 }}>Modal body</p>
          </ModalBody>
        </Modal>
      </section>

      <section data-testid="gallery-select">
        <h2 style={{ fontSize: 'var(--font-size-md)' }}>Select / Input</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', maxWidth: 420 }}>
          <Select
            value={select}
            onChange={setSelect}
            options={[
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
            ]}
          />
          <Input placeholder="Input" />
        </div>
      </section>

      <section data-testid="gallery-widget">
        <h2 style={{ fontSize: 'var(--font-size-md)' }}>Widget</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <MetricWidget title="Metric" value="128" delta="+12%" deltaPositive />
          <ChartWidget
            title="Chart"
            chart={{
              preset: 'TrafficTrend',
              data: {
                labels: ['1', '2', '3', '4'],
                points: [
                  { label: '1', value: 4 },
                  { label: '2', value: 8 },
                  { label: '3', value: 6 },
                  { label: '4', value: 12 },
                ],
              },
              overrides: { height: 120 },
            }}
          />
          <WidgetShell title="Loading" state="loading" />
          <WidgetShell title="Empty" state="empty" emptyDescription="Nothing yet" />
        </div>
      </section>
    </div>
  );
}

export default KoalaGallery;
