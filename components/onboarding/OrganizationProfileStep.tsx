import React, { useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import ORG_NAME_MAX_LENGTH, { ORG_LOGO_MAX_BYTES, ORG_LOGO_MAX_LABEL } from '../../lib/organizationLimits';
import Button from '../koala/primitives/Button';
import Input from '../koala/primitives/Input';
import { Icon } from '../koala/icons/Icon';
import { semantic } from '../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../koala/tokens/typography';
import { spacing } from '../koala/tokens/spacing';
import { radius } from '../koala/tokens/effects';

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

export type OrganizationProfileValue = {
  name: string;
  /** Data URL of a newly picked logo, or null when none is staged. */
  logoDataUrl: string | null;
};

type Props = {
  value: OrganizationProfileValue;
  onChange: (value: OrganizationProfileValue) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  alignItems: 'center',
  fontSize: textScale.sm.fontSize,
  lineHeight: textScale.sm.lineHeight,
  letterSpacing: textScale.sm.letterSpacing,
  fontWeight: fontWeight.medium,
  color: semantic.text.primary,
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: textScale.xs.fontSize,
  lineHeight: textScale.xs.lineHeight,
  letterSpacing: textScale.xs.letterSpacing,
  color: semantic.text.secondary,
};

const avatarStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  flexShrink: 0,
  borderRadius: radius.full,
  border: `1px solid ${semantic.border.primary}`,
  background: semantic.background.secondary,
  color: semantic.text.tertiary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

/** Local preview of the staged data URL — styled.img keeps it out of next/image's remote-loader path. */
const LogoPreview = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const rootStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing['2xl'],
  textAlign: 'left',
  fontFamily: typeface.body,
};

/** Organization identity step — Koala register-flow "Complete your profile" (Figma `8740:416202`). */
const OrganizationProfileStep = ({ value, onChange, onError, disabled = false }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  // FileReader resolves a tick or more later, by which time the name the user kept
  // typing has moved on — spreading the captured `value` there would restore the old
  // one. Read the current value at callback time instead.
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  // Only the newest pick may write; an earlier, slower read is discarded rather than
  // overwriting the logo the user chose second.
  const readToken = useRef(0);

  const pickFile = (file: File | undefined): void => {
    if (!file) return;
    if (file.size > ORG_LOGO_MAX_BYTES) {
      onError(`That image is over ${ORG_LOGO_MAX_LABEL}. Pick a smaller one.`);
      return;
    }
    readToken.current += 1;
    const token = readToken.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (token !== readToken.current) return;
      onChange({ ...latest.current, logoDataUrl: typeof reader.result === 'string' ? reader.result : null });
    };
    reader.onerror = () => {
      if (token !== readToken.current) return;
      onError("Couldn't read that file. Try another image.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={rootStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        <label htmlFor="onboarding-org-name" style={fieldLabelStyle}>
          Organization name
          <span style={{ color: semantic.text.brand }}>*</span>
        </label>
        <Input
          id="onboarding-org-name"
          type="text"
          size="lg"
          value={value.name}
          disabled={disabled}
          maxLength={ORG_NAME_MAX_LENGTH}
          placeholder="e.g. Acme Marketing"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        <span style={fieldLabelStyle}>Logo</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xl }}>
          <div style={avatarStyle}>
            {value.logoDataUrl
              ? <LogoPreview src={value.logoDataUrl} alt="" />
              : <Icon name="Buildings" size={20} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: spacing.md }}>
              <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => fileRef.current?.click()}>
                Upload image
              </Button>
              {value.logoDataUrl && (
                <Button type="button" variant="transparent" size="sm" disabled={disabled} onClick={() => onChange({ ...value, logoDataUrl: null })}>
                  Remove
                </Button>
              )}
            </div>
            <p style={hintStyle}>{`Up to ${ORG_LOGO_MAX_LABEL} — PNG, JPG, GIF or WEBP.`}</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
    </div>
  );
};

export default OrganizationProfileStep;
