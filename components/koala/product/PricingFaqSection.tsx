import React, { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import toast from 'react-hot-toast';
import { Button, SegmentedControl } from '../core';
import { Icon } from '../icons/Icon';
import { semantic } from '../tokens/semantic';
import { typeface, fontWeight } from '../tokens/typography';

export type FaqCategory = 'billing' | 'product' | 'usage';

export type FaqItem = {
  q: string;
  a: string;
  category: FaqCategory;
};

type Props = {
  items: FaqItem[];
  contactHref?: string;
  className?: string;
};

const COLLAPSED_COUNT = 5;

const Root = styled.section`
  font-family: ${typeface.body};
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 64px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: flex-start;
  width: 100%;
  max-width: 560px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 48px;
  line-height: 52px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.24px;
  color: ${semantic.text.primary};
`;

const Sub = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: -0.25px;
  color: ${semantic.text.secondary};
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  width: 100%;
`;

const AccordionWrap = styled.div`
  position: relative;
  width: 100%;
  max-width: 592px;
`;

const AccordionList = styled.div<{ $collapsed: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  ${(p) => (p.$collapsed ? 'max-height: 420px; overflow: hidden;' : '')}
`;

const Fade = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 160px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(245, 245, 245, 0) 0%, ${semantic.background.secondary} 72%);
`;

const SeeAllWrap = styled.div`
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 1;
`;

const Item = styled.div<{ $filled?: boolean }>`
  width: 100%;
  border-bottom: ${(p) => (p.$filled ? 'none' : `1px solid ${semantic.border.primary}`)};
  background: ${(p) => (p.$filled ? semantic.background.secondary : 'transparent')};
  border-radius: ${(p) => (p.$filled ? '16px' : '0')};
  padding: ${(p) => (p.$filled ? '16px' : '0')};
  box-sizing: border-box;
  /* plain descendant — no Emotion component selectors (project has no babel/swc emotion plugin) */
  ${(p) => (p.$filled ? '& > button { padding: 0; }' : '')}
`;

const ItemButton = styled.button`
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 16px;
  padding: 24px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
`;

const ItemPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 0 24px;
  box-sizing: border-box;
`;

const Q = styled.span<{ $open?: boolean; $filled?: boolean }>`
  flex: 1;
  min-width: 0;
  font-size: 18px;
  line-height: 26px;
  font-weight: ${(p) => (p.$filled ? fontWeight.bold : fontWeight.medium)};
  letter-spacing: -0.5px;
  color: ${semantic.text.primary};
`;

const Answer = styled.p`
  margin: 4px 0 0;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: -0.25px;
  color: ${semantic.text.secondary};
`;

const FeedbackRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  padding-top: 8px;
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 64px;
  align-items: center;
  justify-content: center;
  width: 100%;
`;

const CtaCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 408px;
`;

const CtaTitle = styled.p`
  margin: 0;
  font-size: 30px;
  line-height: 36px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.07px;
  color: ${semantic.text.primary};
`;

const CtaSub = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: -0.25px;
  color: ${semantic.text.secondary};
`;

const TAB_LABELS: Record<FaqCategory, string> = {
  billing: 'Billing',
  product: 'Product',
  usage: 'Usage',
};

/** Marketing FAQ accordion — Figma `3827:248547` (Ranksmile copy). */
export function PricingFaqSection({ items, contactHref = 'mailto:hello@ranksmile.pl', className }: Props) {
  const [tab, setTab] = useState<FaqCategory>('billing');
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => items.filter((i) => i.category === tab), [items, tab]);
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const collapsed = !expanded && filtered.length > COLLAPSED_COUNT;

  React.useEffect(() => {
    const list = items.filter((i) => i.category === tab);
    setOpenId(list[1]?.q ?? list[0]?.q ?? null);
    setExpanded(false);
  }, [tab, items]);

  return (
    <Root className={className} aria-labelledby="pricing-faq-heading">
      <Header>
        <Title id="pricing-faq-heading">Have any questions? We&apos;ve got answers.</Title>
        <Sub>
          Explore quick answers to the most common questions about Ranksmile plans, billing, and how the product works.
        </Sub>
      </Header>

      <Body>
        <SegmentedControl
          name="pricing-faq-tabs"
          size="sm"
          value={tab}
          onChange={setTab}
          options={(Object.keys(TAB_LABELS) as FaqCategory[]).map((value) => ({
            value,
            label: TAB_LABELS[value],
          }))}
        />

        <AccordionWrap>
          <AccordionList $collapsed={collapsed}>
            {visible.map((item, idx) => {
              const open = openId === item.q;
              const filled = !open && idx === visible.length - 1 && collapsed;
              return (
                <Item key={item.q} $filled={filled} data-filled={filled ? 'true' : undefined}>
                  <ItemButton
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId((prev) => (prev === item.q ? null : item.q))}
                    style={filled ? { padding: 0 } : undefined}
                  >
                    <Q $open={open} $filled={filled}>{item.q}</Q>
                    <Icon
                      name={open ? 'CaretUp' : 'CaretDown'}
                      size={20}
                      weight="bold"
                      color={semantic.text.primary}
                    />
                  </ItemButton>
                  {open ? (
                    <ItemPanel>
                      <Answer>{item.a}</Answer>
                      <FeedbackRow>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={<Icon name="ThumbsUp" size={16} weight="bold" />}
                          onClick={() => {
                            toast.success('Thanks for the feedback');
                          }}
                        >
                          Helpful
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={<Icon name="ThumbsDown" size={16} weight="bold" />}
                          onClick={() => {
                            toast.success('Thanks — we will improve this answer');
                          }}
                        >
                          Not helpful
                        </Button>
                      </FeedbackRow>
                    </ItemPanel>
                  ) : null}
                </Item>
              );
            })}
          </AccordionList>

          {collapsed ? (
            <>
              <Fade aria-hidden />
              <SeeAllWrap>
                <Button type="button" variant="secondary" size="md" onClick={() => setExpanded(true)}>
                  See all questions
                </Button>
              </SeeAllWrap>
            </>
          ) : null}
        </AccordionWrap>
      </Body>

      <CtaRow>
        <CtaCopy>
          <CtaTitle>Have any more questions?</CtaTitle>
          <CtaSub>
            Reach out to our team and we will help you pick the right plan for your workspace.
          </CtaSub>
        </CtaCopy>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            if (contactHref.startsWith('mailto:') || contactHref.startsWith('http')) {
              window.location.href = contactHref;
              return;
            }
            toast('Contact our sales team!');
          }}
        >
          Contact us
        </Button>
      </CtaRow>
    </Root>
  );
}

export default PricingFaqSection;
