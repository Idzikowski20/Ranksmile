import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input } from '../../core';
import type { BusinessPlace } from '../../../lib/local/types';
import { searchPlaces } from '../../../lib/local/mockPlaces';
import { IconClose, IconSearch } from '../icons';

const FONT = 'var(--font-family-primary)';
const MIN_QUERY_LEN = 2;
const SEARCH_DEBOUNCE_MS = 280;

type LocalSearchHeroProps = {
  onSelect: (place: BusinessPlace) => void;
  country?: string;
};

type PlacesSearchPayload = {
  places?: BusinessPlace[];
};

export default function LocalSearchHero({ onSelect, country = 'PL' }: LocalSearchHeroProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<BusinessPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const localResults = searchPlaces(trimmed);
    setSuggestions(localResults);
    setOpen(localResults.length > 0);
    setActiveIndex(-1);

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, country });
        const response = await fetch(`/api/local/places-search?${params.toString()}`);
        if (requestIdRef.current !== requestId) return;

        if (!response.ok) return;

        const data = (await response.json()) as PlacesSearchPayload;
        const remote = data.places ?? [];
        if (requestIdRef.current !== requestId) return;

        setSuggestions(remote);
        setOpen(remote.length > 0);
        setActiveIndex(-1);
      } catch {
        // Keep local mock results when the API is unavailable.
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, country]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = useCallback((place: BusinessPlace) => {
    setQuery(place.name);
    setOpen(false);
    onSelect(place);
  }, [onSelect]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <section className="local-setup-hero" style={{ fontFamily: FONT }}>
      <div className="local-setup-hero-content">
        <span className="local-setup-hero-eyebrow">Local Dashboard</span>
        <h1 className="local-setup-hero-title">Automate your local growth</h1>
        <p className="local-setup-hero-subtitle">
          From Google to AI search—show up everywhere local customers search, with optimized
          Google Business Profile, listings, reviews, and rankings.
        </p>
        <div ref={wrapRef} className="local-setup-search-wrap">
          <div className="local-setup-search-bar">
            <Input
              size="md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => { if (suggestions.length > 0 && query.trim().length >= MIN_QUERY_LEN) setOpen(true); }}
              placeholder="Put your business name or address to get a free local audit"
              style={{ paddingRight: 52, width: '100%' }}
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls="local-place-suggestions"
            />
            {query && (
              <button
                type="button"
                className="local-setup-search-clear"
                aria-label="Clear search"
                onClick={() => { setQuery(''); setOpen(false); }}
              >
                <IconClose size={14} />
              </button>
            )}
            <Button
              type="button"
              size="md"
              variant="primary"
              className="local-setup-search-btn"
              aria-label="Search"
              onClick={() => { if (suggestions[0]) pick(suggestions[0]); }}
            >
              <IconSearch size={16} color="#FFFFFF" />
            </Button>
          </div>
          {open && (
            <ul id="local-place-suggestions" className="local-setup-suggestions" role="listbox">
              {suggestions.map((place, idx) => (
                <li key={place.id} role="option" aria-selected={idx === activeIndex}>
                  <button
                    type="button"
                    className={`local-setup-suggestion-item${idx === activeIndex ? ' local-setup-suggestion-item--active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick(place)}
                  >
                    <span className="local-setup-suggestion-name">{place.name}</span>
                    <span className="local-setup-suggestion-address">{place.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
