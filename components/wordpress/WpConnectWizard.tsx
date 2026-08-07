import React, { useState } from 'react';
import styled from '@emotion/styled';
import { Button } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';
import { semantic } from '../koala/tokens/semantic';
import { fontWeight, typeface } from '../koala/tokens/typography';

export const WP_PLUGIN_ZIP_URL = '/downloads/ranksmile-plugin.zip';
export const WP_PLUGIN_ZIP_NAME = 'ranksmile-plugin.zip';

type StepStatus = 'done' | 'active' | 'pending';

const Root = styled.div`
  font-family: ${typeface.body};
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 24px 8px;
  text-align: center;
  background:
    radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${semantic.background.brand} 14%, transparent) 0%, transparent 55%),
    ${semantic.background.primary};
  border-radius: 16px 16px 0 0;
`;

const BrandRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
`;

const BrandTile = styled.div<{ $tone: 'brand' | 'wp' }>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: transparent;
  color: ${(p) => (p.$tone === 'wp' ? semantic.text.primary : 'inherit')};
  flex-shrink: 0;
`;

const Chevrons = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  color: ${semantic.text.tertiary};
  opacity: 0.55;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 24px;
  line-height: 32px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.3px;
  color: ${semantic.text.primary};
`;

const Sub = styled.p`
  margin: 0;
  max-width: 420px;
  font-size: 14px;
  line-height: 22px;
  color: ${semantic.text.secondary};
`;

const Steps = styled.ol`
  list-style: none;
  margin: 0;
  padding: 24px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const Step = styled.li`
  display: grid;
  grid-template-columns: 28px 1fr;
  column-gap: 16px;
  align-items: start;
`;

const Rail = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
`;

const Dot = styled.div<{ $status: StepStatus }>`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: ${(p) => {
    if (p.$status === 'done') return semantic.status.success;
    if (p.$status === 'active') return semantic.button.brand.bg;
    return semantic.background.secondary;
  }};
  color: ${(p) => (p.$status === 'pending' ? semantic.text.tertiary : '#fff')};
  border: ${(p) => (p.$status === 'pending' ? `1px solid ${semantic.border.primary}` : 'none')};
`;

const Connector = styled.div`
  width: 0;
  flex: 1;
  min-height: 20px;
  margin: 6px 0;
  border-left: 1.5px dashed ${semantic.border.primary};
`;

const StepBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 28px;
  min-width: 0;
`;

const StepTitle = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
`;

const StepCopy = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: ${semantic.text.secondary};
`;

const PathHint = styled.code`
  display: inline;
  font-family: ${typeface.body};
  font-size: 13px;
  font-weight: 500;
  color: ${semantic.text.primary};
  background: ${semantic.background.secondary};
  border-radius: 6px;
  padding: 1px 6px;
`;

const WpMark = () => (
  <svg width="40" height="40" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M10 0C4.49 0 0 4.48 0 10s4.49 10 10 10 10-4.49 10-10S15.51 0 10 0ZM1.01 10c0-1.3.28-2.54.78-3.66l4.29 11.75A8.99 8.99 0 0 1 1.01 10ZM10 18.99c-.88 0-1.73-.13-2.54-.37l2.7-7.84 2.76 7.57.06.13c-.93.33-1.93.51-2.98.51Zm1.24-13.2c.54-.03 1.03-.09 1.03-.09.48-.06.43-.77-.06-.74 0 0-1.46.11-2.4.11-.88 0-2.37-.11-2.37-.11-.48-.03-.54.71-.06.74 0 0 .46.06.94.09l1.4 3.84-1.97 5.9L4.48 5.79c.55-.03 1.03-.09 1.03-.09.49-.06.43-.77-.06-.74 0 0-1.45.11-2.39.11-.17 0-.37 0-.58-.01A8.98 8.98 0 0 1 9.99 1c2.34 0 4.47.89 6.07 2.36-.04 0-.08-.01-.12-.01-.88 0-1.51.77-1.51 1.6 0 .74.43 1.37.88 2.11.34.6.74 1.37.74 2.48 0 .77-.29 1.66-.69 2.91l-.89 3-3.23-9.66Zm3.28 11.98 2.75-7.94c.51-1.28.68-2.31.68-3.22 0-.33-.02-.64-.06-.93.7 1.28 1.1 2.75 1.1 4.31a8.99 8.99 0 0 1-4.47 7.78Z"
      fill="currentColor"
    />
  </svg>
);

function statusIcon(status: StepStatus) {
  if (status === 'done') {
    return <Icon name="Check" size={14} weight="bold" color="#fff" />;
  }
  if (status === 'active') {
    return <Icon name="ArrowsClockwise" size={14} weight="bold" color="#fff" />;
  }
  return <Icon name="Circle" size={12} weight="bold" color="currentColor" />;
}

type Props = {
  className?: string;
  compact?: boolean;
};

/** Vertical â€śEasy connectâ€ť stepper: download plugin â†’ upload â†’ activate. */
export function WpConnectWizard({ className, compact }: Props) {
  const [downloaded, setDownloaded] = useState(false);

  const step1: StepStatus = downloaded ? 'done' : 'active';
  const step2: StepStatus = downloaded ? 'active' : 'pending';
  const step3: StepStatus = 'pending';

  const onDownload = () => {
    const a = document.createElement('a');
    a.href = WP_PLUGIN_ZIP_URL;
    a.download = WP_PLUGIN_ZIP_NAME;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloaded(true);
  };

  return (
    <Root className={className} data-compact={compact ? 'true' : undefined}>
      <Header>
        <BrandRow aria-hidden>
          <BrandTile $tone="brand">
            <BounceSmileyAnimation compact size={40} entrance={false} animateRotate={false} />
          </BrandTile>
          <Chevrons>
            {[0, 1, 2, 3].map((i) => (
              <Icon key={i} name="CaretRight" size={12} weight="bold" color="currentColor" />
            ))}
          </Chevrons>
          <BrandTile $tone="wp">
            <WpMark />
          </BrandTile>
        </BrandRow>
        <Title>Easy connect</Title>
        <Sub>
          Install the Ranksmile WordPress plugin, then connect your site to publish articles in one click.
        </Sub>
      </Header>

      <Steps>
        <Step>
          <Rail>
            <Dot $status={step1} aria-hidden>{statusIcon(step1)}</Dot>
            <Connector />
          </Rail>
          <StepBody>
            <StepTitle>Download plugin</StepTitle>
            <StepCopy>
              Get the Ranksmile plugin ZIP. You will upload this file in WordPress admin.
            </StepCopy>
            <div>
              <Button
                type="button"
                variant="primary"
                size="md"
                icon={<Icon name="DownloadSimple" size={16} weight="bold" />}
                onClick={onDownload}
              >
                {downloaded ? 'Download again' : 'Download plugin'}
              </Button>
            </div>
          </StepBody>
        </Step>

        <Step>
          <Rail>
            <Dot $status={step2} aria-hidden>{statusIcon(step2)}</Dot>
            <Connector />
          </Rail>
          <StepBody>
            <StepTitle>Upload to your server</StepTitle>
            <StepCopy>
              In WordPress go to{' '}
              <PathHint>Plugins â†’ Add New â†’ Upload Plugin</PathHint>
              . Choose the downloaded ZIP, then click <strong>Install Now</strong>.
            </StepCopy>
          </StepBody>
        </Step>

        <Step>
          <Rail>
            <Dot $status={step3} aria-hidden>{statusIcon(step3)}</Dot>
          </Rail>
          <StepBody style={{ paddingBottom: 0 }}>
            <StepTitle>Activate &amp; connect</StepTitle>
            <StepCopy>
              After install, click <strong>Activate</strong>. Open the Ranksmile plugin screen and connect
              your Ranksmile account â€” the site will then appear in this settings page.
            </StepCopy>
          </StepBody>
        </Step>
      </Steps>
    </Root>
  );
}

export default WpConnectWizard;
