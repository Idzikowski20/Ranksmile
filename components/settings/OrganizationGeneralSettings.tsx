import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';

const Separator = () => (
  <div
    role="separator"
    style={{ minHeight: 1, minWidth: 1, alignSelf: 'stretch', background: '#F4F4F5' }}
  />
);

const OrganizationGeneralSettings = () => {
  const [orgName, setOrgName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    toast.success('Saved');
  };

  return (
    <div className="flex w-full flex-col items-start gap-base">
      {/* Header */}
      <div className="gap-2xs flex flex-col">
        <span className="text-base font-semibold text-gray-140">Organization</span>
        <span className="text-md font-normal text-gray-100">
          Manage your organization settings
        </span>
      </div>

      <Separator />

      {/* Logo section */}
      <div className="flex w-full flex-col gap-sm">
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#18181B',
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          Logo
        </span>

        {/* Avatar + Upload row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {/* Square avatar chip */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              background: 'rgba(120,58,251,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: '#783AFB',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-family-primary)',
                userSelect: 'none',
              }}
            >
              P
            </span>
          </div>

          {/* Upload button + hint */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: '#18181B',
                fontFamily: 'var(--font-family-primary)',
                fontSize: 14,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#52525C'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#18181B'; }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Upload
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  color: '#71717A',
                  fontFamily: 'var(--font-family-primary)',
                }}
              >
                Drag an image or click &ldquo;Upload&rdquo; to browse
              </span>
              {/* Info icon */}
              <button
                type="button"
                aria-label="Logo upload info"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'default',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: '#A1A1AA',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="8" r="0.75" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".png,.jpg,.jpeg,.gif,.webp"
          className="hidden"
          tabIndex={-1}
        />
      </div>

      <Separator />

      {/* Organization Name section */}
      <div className="flex w-full flex-col gap-sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label
            htmlFor="org-name"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#18181B',
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            Organization Name
          </label>
          <input
            id="org-name"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. My organization"
            maxLength={40}
            style={{
              width: 256,
              height: 40,
              border: '1px solid #D4D4D8',
              borderRadius: 8,
              padding: '0 12px',
              fontSize: 14,
              color: '#18181B',
              background: '#FFFFFF',
              fontFamily: 'var(--font-family-primary)',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#AA93FD';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#D4D4D8';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            }}
          />
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        className="gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none text-md px-base py-xs rounded-md bg-gray-base text-white-base hover:bg-purple-base active:bg-purple-100"
      >
        Save
      </button>
    </div>
  );
};

export default OrganizationGeneralSettings;
