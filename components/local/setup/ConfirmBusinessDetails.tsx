import React, { useState } from 'react';
import { Badge, Button, Checkbox, Input, Textarea } from '../../core';
import type { BusinessDetails } from '../../../lib/local/types';
import {
  getConfirmMissingFields,
  getConfirmMissingLabels,
  isConfirmStepComplete,
} from '../../../lib/local/confirmBusinessDetails';
import ChooseCategoriesModal from './ChooseCategoriesModal';
import { IconEdit, IconLightning, IconLock, IconPlus, IconWarning } from '../icons';

const FONT = 'var(--font-family-primary)';

type ConfirmTab = 'general' | 'categories' | 'photos' | 'description' | 'hours';

const TABS: { id: ConfirmTab; label: string; warn?: boolean }[] = [
  { id: 'general', label: 'General info' },
  { id: 'categories', label: 'Business categories', warn: true },
  { id: 'photos', label: 'Photos' },
  { id: 'description', label: 'Description' },
  { id: 'hours', label: 'Hours' },
];

const MORE_HOURS_TAGS = [
  'Breakfast', 'Lunch', 'Senior hours', 'Takeout', 'Access', 'Delivery',
  'Dinner', 'Kitchen', 'Brunch', 'Drive-through', 'Happy hours', 'Online service hours', 'Pickup',
];

type ConfirmBusinessDetailsProps = {
  details: BusinessDetails;
  onChange: (details: BusinessDetails) => void;
  onComplete: () => void;
};

export default function ConfirmBusinessDetails({
  details,
  onChange,
  onComplete,
}: ConfirmBusinessDetailsProps) {
  const [tab, setTab] = useState<ConfirmTab>('general');
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const directoryMissing = details.directoryCategories.length === 0;
  const primaryDirectory = details.directoryCategories[0] ?? null;
  const missingFields = getConfirmMissingFields(details);
  const canDistribute = isConfirmStepComplete(details);
  const missingLabels = getConfirmMissingLabels(details);

  const patch = (partial: Partial<BusinessDetails>) => onChange({ ...details, ...partial });

  const updateHour = (day: string, partial: Partial<BusinessDetails['hours'][number]>) => {
    patch({
      hours: details.hours.map((h) => (h.day === day ? { ...h, ...partial } : h)),
    });
  };

  return (
    <section className="local-setup-card-shell local-setup-confirm" style={{ fontFamily: FONT }}>
      <span className="local-setup-card-eyebrow">Local</span>
      <h1 className="local-setup-card-title">Confirm your business details</h1>
      <p className="local-setup-card-desc">
        Check if the information collected from your Google account is correct.
      </p>

      <div className="local-setup-tabline" role="tablist" aria-label="Business details">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`local-setup-tabline-item${tab === t.id ? ' local-setup-tabline-item--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.warn && directoryMissing && <IconWarning size={14} />}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="local-setup-form" role="tabpanel">
          <FormRow label="Business name">
            <Input size="md" value={details.name} onChange={(e) => patch({ name: e.target.value })} />
          </FormRow>
          <FormRow label="Address">
            <Input size="md" value={details.address} onChange={(e) => patch({ address: e.target.value })} />
          </FormRow>
          <FormRow label="Service area">
            <div className="local-setup-service-area">
              <label className="local-setup-check-row">
                <Checkbox
                  checked={details.hideAddress}
                  onChange={(v) => patch({ hideAddress: v })}
                  size="sm"
                />
                <span>Hide our address</span>
              </label>
              <label className="local-setup-check-row">
                <Checkbox
                  checked={details.deliversLocally}
                  onChange={(v) => patch({ deliversLocally: v })}
                  size="sm"
                />
                <span>We deliver to local customers</span>
              </label>
              {details.deliversLocally && (
                <div className="local-setup-service-tags">
                  {details.serviceAreas.map((area) => (
                    <span key={area} className="local-setup-service-tag">
                      {area}
                      <button
                        type="button"
                        aria-label={`Remove ${area}`}
                        onClick={() => patch({ serviceAreas: details.serviceAreas.filter((a) => a !== area) })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <Input
                    size="sm"
                    placeholder="City, county, region, postal code, etc."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim();
                        if (val && !details.serviceAreas.includes(val)) {
                          patch({ serviceAreas: [...details.serviceAreas, val] });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </FormRow>
          <FormRow label="Phone number">
            <Input size="md" value={details.phone} onChange={(e) => patch({ phone: e.target.value })} />
          </FormRow>
          <FormRow label="Website">
            <Input
              size="md"
              value={details.website}
              onChange={(e) => patch({ website: e.target.value })}
              placeholder="Enter your business website"
            />
          </FormRow>
        </div>
      )}

      {tab === 'categories' && (
        <div className="local-setup-categories-panels" role="tabpanel">
          <div className="local-setup-category-panel">
            <strong>For Google</strong>
            <ul>
              {details.googleCategories.map((cat, i) => (
                <li key={cat}>
                  {cat}
                  {i === 0 && <Badge variant="info">Primary</Badge>}
                </li>
              ))}
            </ul>
            <div className="local-setup-category-footer">
              <Button type="button" size="sm" variant="secondary" disabled>
                <IconLock size={14} />
                Edit
              </Button>
              <span>Editable after setup</span>
            </div>
          </div>
          <div className={`local-setup-category-panel${directoryMissing ? ' local-setup-category-panel--empty' : ''}`}>
            <strong>For other directories</strong>
            {directoryMissing ? (
              <p className="local-setup-category-error">Add at least one category.</p>
            ) : (
              <ul>
                {details.directoryCategories.map((cat, i) => (
                  <li key={cat}>
                    {cat}
                    {i === 0 && <Badge variant="info">Primary</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <div className="local-setup-category-footer">
              <Button type="button" size="sm" variant="secondary" onClick={() => setCategoriesOpen(true)}>
                <IconEdit size={14} />
                Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'photos' && (
        <div className="local-setup-photos" role="tabpanel">
          <PhotoSlot label="Logo" wide={false} url={details.logoUrl} />
          <PhotoSlot label="Cover photo" wide url={details.coverUrl} />
          <div className="local-setup-photos-gallery">
            <span>
              Business photos
              {' '}
              {details.photoUrls.length}
            </span>
            <button type="button" className="local-setup-link-btn">Add photos</button>
            <div className="local-setup-photo-grid">
              {details.photoUrls.map((url) => (
                <div key={url} className="local-setup-photo-thumb">
                  <img src={url} alt="Business" />
                </div>
              ))}
              <button type="button" className="local-setup-photo-add" aria-label="Add photo">
                <IconPlus size={24} />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'description' && (
        <div role="tabpanel">
          <Textarea
            rows={8}
            maxLength={750}
            value={details.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Describe the services your business provides"
            resize="none"
            style={{ width: '100%' }}
          />
        </div>
      )}

      {tab === 'hours' && (
        <div className="local-setup-hours" role="tabpanel">
          <div className="local-setup-hours-card">
            <h3>Business hours</h3>
            {details.hours.map((row) => (
              <div key={row.day} className="local-setup-hours-row">
                <span className="local-setup-hours-day">{row.day}</span>
                <select
                  value={row.status}
                  onChange={(e) => updateHour(row.day, {
                    status: e.target.value as 'open' | 'closed',
                  })}
                  className="local-setup-hours-select"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
                {row.status === 'open' && (
                  <>
                    <input
                      type="time"
                      value={row.openTime ?? '08:00'}
                      onChange={(e) => updateHour(row.day, { openTime: e.target.value })}
                      className="local-setup-time-input"
                    />
                    <span>–</span>
                    <input
                      type="time"
                      value={row.closeTime ?? '16:00'}
                      onChange={(e) => updateHour(row.day, { closeTime: e.target.value })}
                      className="local-setup-time-input"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="local-setup-hours-card">
            <h3>Special hours</h3>
            <Button type="button" size="sm" variant="secondary">
              <IconPlus size={14} />
              Add a date
            </Button>
          </div>
          <div className="local-setup-hours-card">
            <h3>Add more hours</h3>
            <ul className="local-setup-more-hours">
              {MORE_HOURS_TAGS.map((tag) => (
                <li key={tag}>
                  <button type="button" className="local-setup-more-hours-tag">
                    <IconPlus size={14} />
                    {tag}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {canDistribute ? (
        <div className="local-setup-finish">
          <strong>All set. Great job!</strong>
          <p>
            Let&apos;s roll out your business to dozens of websites and directories with a single click.
            <br />
            Yes, it&apos;s magic.
          </p>
          <Button
            type="button"
            size="md"
            variant="primary"
            onClick={onComplete}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <IconLightning size={16} />
              Distribute business info
            </span>
          </Button>
        </div>
      ) : (
        <div className="local-setup-finish local-setup-finish--pending">
          <strong>Complete required details</strong>
          <p>Fill in the missing fields before distributing your business info.</p>
          <ul className="local-setup-finish-missing">
            {missingLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          {missingFields.includes('directoryCategories') && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setTab('categories');
                setCategoriesOpen(true);
              }}
              style={{ marginTop: 4 }}
            >
              Add business categories
            </Button>
          )}
        </div>
      )}

      <ChooseCategoriesModal
        open={categoriesOpen}
        selected={details.directoryCategories}
        primary={primaryDirectory}
        onClose={() => setCategoriesOpen(false)}
        onApply={(selected, primary) => {
          const ordered = primary
            ? [primary, ...selected.filter((s) => s !== primary)]
            : selected;
          patch({ directoryCategories: ordered });
          setCategoriesOpen(false);
        }}
      />
    </section>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="local-setup-form-row">
      <label>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function PhotoSlot({ label, wide, url }: { label: string; wide: boolean; url?: string }) {
  return (
    <div className="local-setup-photo-slot">
      <span>{label}</span>
      {url ? (
        <div className={`local-setup-photo-thumb${wide ? ' local-setup-photo-thumb--wide' : ''}`}>
          <img src={url} alt={label} />
        </div>
      ) : (
        <button
          type="button"
          className={`local-setup-photo-add${wide ? ' local-setup-photo-add--wide' : ''}`}
          aria-label={`Add ${label}`}
        >
          <IconPlus size={24} />
        </button>
      )}
    </div>
  );
}
