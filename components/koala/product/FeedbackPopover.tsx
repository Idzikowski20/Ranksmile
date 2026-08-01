import React, { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import styled from '@emotion/styled';
import { Popover } from '../primitives/Popover';
import Button from '../primitives/Button';
import Textarea from '../core/textarea';
import { FormActions, FormField } from '../forms';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { useFeedbackForm } from '../../../services/feedback';

const Panel = styled.div`
  width: 320px;
  padding: ${spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
  font-family: ${typeface.body};
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${textScale.base.fontSize};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
`;

const EmojiRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: space-between;
`;

const EmojiBtn = styled.button<{ $on: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$on ? semantic.border.brand : semantic.border.primary)};
  background: ${(p) => (p.$on ? semantic.background.secondary : semantic.card.bg)};
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
`;

const EMOJIS = ['😠', '😕', '😐', '🙂', '🤩'];

export type FeedbackPopoverProps = {
  context: string;
  children: (args: { open: () => void; anchorRef: React.RefObject<HTMLElement | null> }) => React.ReactNode;
};

export function FeedbackPopover({ context, children }: FeedbackPopoverProps) {
  const router = useRouter();
  const anchorRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const { score, setScore, message, setMessage, busy, submit, reset } = useFeedbackForm();

  const openPopover = () => {
    const el = anchorRef.current;
    if (el) setRect(el.getBoundingClientRect());
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const onSubmit = async () => {
    const ok = await submit({
      context,
      route: router.asPath,
      component: 'FeedbackPopover',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });
    if (ok) close();
  };

  return (
    <>
      {children({ open: openPopover, anchorRef })}
      <Popover open={open} onClose={close} anchorRect={rect} placement="bottom">
        <Panel>
          <Title>How was your experience?</Title>
          <EmojiRow role="group" aria-label="Rating">
            {EMOJIS.map((emoji, i) => (
              <EmojiBtn
                key={emoji}
                type="button"
                $on={score === i + 1}
                aria-pressed={score === i + 1}
                aria-label={`Rate ${i + 1} of 5`}
                onClick={() => setScore(i + 1)}
              >
                {emoji}
              </EmojiBtn>
            ))}
          </EmojiRow>
          <FormField label="Tell us more (optional)">
            <Textarea
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              placeholder="What could we improve?"
              rows={3}
            />
          </FormField>
          <FormActions>
            <Button type="button" variant="secondary" size="sm" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => { void onSubmit(); }} busy={busy} disabled={busy}>
              Submit
            </Button>
          </FormActions>
        </Panel>
      </Popover>
    </>
  );
}

export default FeedbackPopover;
