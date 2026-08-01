import React, { useMemo } from 'react';
import styled from '@emotion/styled';
import Button from '../primitives/Button';
import { Input } from '../primitives';
import MenuListItem from '../core/menuListItem';
import { MenuList } from '../core/menuList';
import { showToast } from '../../../lib/toast';
import { semantic } from '../tokens/semantic';
import { spacing } from '../tokens/spacing';

const Row = styled.div`
  display: flex;
  gap: ${spacing.sm};
  padding: ${spacing.sm};
`;

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast({ type: 'success', message: `${label} copied` });
  } catch {
    showToast({ type: 'error', message: 'Could not copy' });
  }
}

export type SharePopoverContentProps = {
  url: string;
  title?: string;
  onClose?: () => void;
};

/** Share actions — use inside Koala Popover (not Dialog). */
export function SharePopoverContent({ url, title = 'Shared from Ranksmile', onClose }: SharePopoverContentProps) {
  const markdown = useMemo(() => `[${title}](${url})`, [title, url]);

  return (
    <MenuList
      header="Share"
      className="koala-share-popover"
      footer={
        <>
          <Row>
            <Input size="sm" readOnly value={url} style={{ flex: 1 }} />
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => { void copyText(url, 'Link'); }}
            >
              Copy
            </Button>
          </Row>
          <MenuListItem
            label="Copy markdown"
            onClick={() => { void copyText(markdown, 'Markdown'); onClose?.(); }}
          />
          <MenuListItem
            label="Copy plain URL"
            onClick={() => { void copyText(url, 'URL'); onClose?.(); }}
          />
          <MenuListItem
            label="Open link"
            as="a"
            href={url}
            onClick={() => onClose?.()}
          />
        </>
      }
    >
      <p style={{ margin: 0, padding: '8px 10px', fontSize: 13, color: 'var(--koala-text-secondary)' }}>
        Anyone with the link can view this article.
      </p>
    </MenuList>
  );
}

export default SharePopoverContent;
