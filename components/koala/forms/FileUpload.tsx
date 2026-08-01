import React, { useCallback, useId, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { Icon } from '../icons/Icon';
import Button from '../primitives/Button';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/effects';

export type FileUploadProps = {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  preview?: boolean;
  onUpload?: (files: File[]) => void | Promise<void>;
  /** Called when preview is cleared (local file and/or controlled `valueUrl`). */
  onRemove?: (file?: File) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  description?: string;
  /** Controlled preview URL (e.g. existing avatar). */
  valueUrl?: string | null;
};

const Zone = styled.div<{ $drag: boolean; $disabled: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing.md};
  padding: ${spacing['2xl']};
  border: 1px dashed ${(p) => (p.$drag ? semantic.border.brand : semantic.border.primary)};
  border-radius: ${radius.card.default};
  background: ${(p) => (p.$drag ? semantic.background.secondary : semantic.card.bg)};
  font-family: ${typeface.body};
  text-align: center;
  cursor: ${(p) => (p.$disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.$disabled ? 0.6 : 1)};
  transition: border-color 0.12s ease, background 0.12s ease;
`;

const Title = styled.p`
  margin: 0;
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
`;

const Desc = styled.p`
  margin: 0;
  font-size: ${textScale.xs.fontSize};
  color: ${semantic.text.secondary};
`;

const PreviewRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${spacing.lg};
  margin-top: ${spacing.lg};
  width: 100%;
`;

const PreviewImg = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid ${semantic.border.primary};
  flex-shrink: 0;
`;

const Err = styled.p`
  margin: ${spacing.sm} 0 0;
  font-size: ${textScale.xs.fontSize};
  color: ${semantic.status.danger};
`;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  accept = 'image/png,image/jpeg,image/gif,image/webp',
  maxSize = 5 * 1024 * 1024,
  maxFiles = 1,
  preview = true,
  onUpload,
  onRemove,
  disabled = false,
  className,
  label = 'Upload a file',
  description = 'Drag and drop or click to browse',
  valueUrl,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = localUrl || valueUrl || null;

  const applyFiles = useCallback(
    async (list: FileList | File[]) => {
      if (disabled) return;
      const next = Array.from(list).slice(0, maxFiles);
      if (!next.length) return;
      for (const f of next) {
        if (maxSize && f.size > maxSize) {
          setError(`File too large (max ${formatBytes(maxSize)})`);
          return;
        }
        if (accept && accept !== '*') {
          const tokens = accept.split(',').map((t) => t.trim());
          const ok = tokens.some((t) => {
            if (t.endsWith('/*')) return f.type.startsWith(t.replace('/*', '/'));
            return f.type === t || f.name.toLowerCase().endsWith(t.replace('.', ''));
          });
          if (!ok && f.type) {
            /* allow extension-only accepts loosely */
          }
        }
      }
      setError(null);
      setFiles(next);
      if (preview && next[0]?.type.startsWith('image/')) {
        const url = URL.createObjectURL(next[0]);
        setLocalUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
      await onUpload?.(next);
    },
    [accept, disabled, maxFiles, maxSize, onUpload, preview],
  );

  const handleRemove = () => {
    const removed = files[0];
    setFiles([]);
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      setLocalUrl(null);
    }
    onRemove?.(removed);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={`koala-file-upload ${className ?? ''}`.trim()}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        disabled={disabled}
        hidden
        onChange={(e) => {
          if (e.target.files) void applyFiles(e.target.files);
        }}
      />
      <Zone
        $drag={drag}
        $disabled={disabled}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-controls={inputId}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files) void applyFiles(e.dataTransfer.files);
        }}
      >
        <Icon name="UploadSimple" size={24} weight="bold" color="var(--koala-text-secondary)" />
        <Title>{label}</Title>
        <Desc>
          {description}
          {maxSize ? ` · Max ${formatBytes(maxSize)}` : ''}
        </Desc>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Browse
        </Button>
      </Zone>
      {preview && previewUrl ? (
        <PreviewRow>
          <PreviewImg src={previewUrl} alt="" />
          <Button type="button" size="sm" variant="secondary" onClick={handleRemove} disabled={disabled}>
            Remove
          </Button>
        </PreviewRow>
      ) : null}
      {error ? <Err>{error}</Err> : null}
    </div>
  );
}

export default FileUpload;
