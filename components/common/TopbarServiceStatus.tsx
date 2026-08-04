import React, { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { MenuList } from '../koala/core/menuList';
import { Icon } from '../koala/icons/Icon';
import { semantic } from '../koala/tokens/semantic';
import { spacing } from '../koala/tokens/spacing';
import { fontWeight } from '../koala/tokens/typography';
import { levelCss } from '../../lib/serviceStatus';
import { useServiceStatus } from '../../services/serviceStatus';

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

const StatusDot = styled.span<{ $tone: 'green' | 'yellow' | 'red' }>`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  border: 1.5px solid ${semantic.background.primary};
  background: ${(p) =>
    p.$tone === 'green' ? '#1AB25E' : p.$tone === 'yellow' ? '#FFC53D' : '#FF4444'};
`;

const Panel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 400;
  width: min(340px, calc(100vw - 24px));
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
`;

const Row = styled.li`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: ${spacing.md};
  border-radius: 10px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Dot = styled.span<{ $tone: 'green' | 'yellow' | 'red' }>`
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: ${(p) =>
    p.$tone === 'green' ? '#1AB25E' : p.$tone === 'yellow' ? '#FFC53D' : '#FF4444'};
`;

const Label = styled.span<{ $tone: 'green' | 'yellow' | 'red' }>`
  font-size: 13px;
  font-weight: ${fontWeight.bold};
  color: ${(p) =>
    p.$tone === 'green' ? '#1AB25E' : p.$tone === 'yellow' ? '#B45309' : '#DC2626'};
`;

const Time = styled.span`
  font-size: 12px;
  color: ${semantic.text.tertiary};
`;

const Msg = styled.p`
  margin: 0 0 0 16px;
  font-size: 13px;
  line-height: 1.4;
  color: ${semantic.text.secondary};
`;

/** Service health status — restored from sidebar nav footer into Product Header. */
const TopbarServiceStatus = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useServiceStatus();
  const tone = levelCss(data?.overall ?? 'ok');

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

  const services = data?.services ?? [];

  return (
    <div ref={ref} className="global-topbar-btnbar-item" style={{ position: 'relative' }}>
      <TriggerBtn
        type="button"
        aria-label="Service status"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="Broadcast" size={20} weight="bold" />
        <StatusDot $tone={tone} aria-hidden="true" />
      </TriggerBtn>

      {open ? (
        <Panel>
          <MenuList
            header={<Title>{isLoading ? 'Checking status…' : (data?.title ?? 'All systems operational')}</Title>}
            footer={null}
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {services.map((s) => {
                const css = levelCss(s.level);
                return (
                  <Row key={s.id}>
                    <Head>
                      <Dot $tone={css} />
                      <Label $tone={css}>{s.name}</Label>
                      <Time>({s.label})</Time>
                    </Head>
                    <Msg>{s.msg}</Msg>
                  </Row>
                );
              })}
              {!isLoading && services.length === 0 ? (
                <Row>
                  <Head>
                    <Dot $tone={tone} />
                    <Label $tone={tone}>Status</Label>
                    <Time>(Unknown)</Time>
                  </Head>
                  <Msg>Could not load service status.</Msg>
                </Row>
              ) : null}
            </ul>
          </MenuList>
        </Panel>
      ) : null}
    </div>
  );
};

export default TopbarServiceStatus;
