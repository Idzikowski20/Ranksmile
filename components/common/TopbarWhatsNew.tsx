import React, { useEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import styled from '@emotion/styled';
import { MenuList } from '../koala/core/menuList';
import { Icon } from '../koala/icons/Icon';
import { semantic } from '../koala/tokens/semantic';
import { spacing } from '../koala/tokens/spacing';
import { fontWeight } from '../koala/tokens/typography';
import ChangeLog from '../settings/Changelog';

type Entry = { title: string; body: string; href: string };

const ENTRIES: Entry[] = [
  {
    title: 'Redesigned navigation',
    body: 'A new sidebar with workspace switcher and quicker access to SEO and AI Visibility tools.',
    href: 'https://ranksmile.pl',
  },
  {
    title: 'AI Visibility tracking',
    body: 'Monitor how AI search engines mention your brand, track competitors, and discover content opportunities.',
    href: 'https://ranksmile.pl',
  },
  {
    title: 'Content recommendations',
    body: 'Automated content audits surface pages that need optimization and ideas for new content to create.',
    href: 'https://ranksmile.pl',
  },
];

const TriggerBtn = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 4px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: ${semantic.text.secondary};
  cursor: pointer;
  &:hover,
  &[aria-expanded='true'] {
    background: ${semantic.background.secondary};
    color: ${semantic.text.primary};
  }
`;

const Panel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 400;
  width: min(360px, calc(100vw - 24px));
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm};
  font-size: 14px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
`;

const FullLink = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-size: 12px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.brand};
  font-family: var(--font-family-primary);
  &:hover { text-decoration: underline; }
`;

const Item = styled.li`
  padding: ${spacing.md};
  border-radius: 10px;
  &:not(:last-child) {
    border-bottom: 1px solid ${semantic.border.primary};
    border-radius: 0;
  }
`;

const ItemHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
`;

const ItemTitle = styled.a`
  flex: 1;
  font-size: 14px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  text-decoration: none;
  line-height: 1.3;
  &:hover { text-decoration: underline; }
`;

const Tag = styled.span`
  flex-shrink: 0;
  font-size: 10px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.brand};
  background: color-mix(in srgb, ${semantic.text.brand} 14%, transparent);
  border-radius: 9999px;
  padding: 2px 8px;
  white-space: nowrap;
`;

const Body = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: ${semantic.text.secondary};
`;

const ReadMore = styled.a`
  color: ${semantic.text.brand};
  text-decoration: none;
  margin-left: 4px;
  &:hover { text-decoration: underline; }
`;

/** What's New / changelog — restored from sidebar nav footer into Product Header. */
const TopbarWhatsNew = () => {
  const [open, setOpen] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <div ref={ref} className="global-topbar-btnbar-item" style={{ position: 'relative' }}>
        <TriggerBtn
          type="button"
          aria-label="What's New"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="Flame" size={20} weight="bold" />
        </TriggerBtn>

        {open ? (
          <Panel>
            <MenuList
              header={(
                <Title>
                  <span>What&apos;s new</span>
                  <FullLink
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setShowChangelog(true);
                    }}
                  >
                    Full changelog
                  </FullLink>
                </Title>
              )}
              footer={null}
            >
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 420, overflowY: 'auto' }}>
                {ENTRIES.map((c) => (
                  <Item key={c.title}>
                    <ItemHead>
                      <ItemTitle href={c.href} target="_blank" rel="noreferrer noopener">{c.title}</ItemTitle>
                      <Tag>New Feature</Tag>
                    </ItemHead>
                    <Body>
                      {c.body}
                      <ReadMore href={c.href} target="_blank" rel="noreferrer noopener">Read more</ReadMore>
                    </Body>
                  </Item>
                ))}
              </ul>
            </MenuList>
          </Panel>
        ) : null}
      </div>

      <CSSTransition in={showChangelog} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
        <ChangeLog closeChangeLog={() => setShowChangelog(false)} />
      </CSSTransition>
    </>
  );
};

export default TopbarWhatsNew;
