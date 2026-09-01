import React, { useState } from 'react';
import styled from '@emotion/styled';
import { Icon } from '../icons/Icon';
import type {
  CompareCell,
  CompareSection,
  CtaState,
  PlanSlug,
} from '../../../lib/pricing/planDefinition';
import {
  COMPARE_SECTIONS,
  PRICING_GRID_SLUGS,
  getPlanDefinition,
  planDisplayPrice,
  trackPricingEvent,
} from '../../../lib/pricing/planDefinition';
import type { BillingPeriod } from '../../../lib/billingPlans';
import type { PricingCardAction } from './PricingCard';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';

export type ComparePricingTableProps = {
  billing: BillingPeriod;
  sections?: CompareSection[];
  resolveCta: (slug: PlanSlug) => CtaState;
  onAction: (action: PricingCardAction) => void;
  className?: string;
};

const Root = styled.section`
  font-family: ${typeface.body};
  width: 100%;
  background: ${semantic.background.primary};
`;

const Desktop = styled.div`
  display: none;
  @media (min-width: 900px) {
    display: block;
    width: 100%;
    overflow-x: auto;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
  min-width: 720px;
  align-items: start;
`;

const Col = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
`;

const HeaderCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  justify-content: center;
  padding: 24px 0;
  border-bottom: 1px solid ${semantic.border.primary};
  box-sizing: border-box;
  min-height: 152px;
`;

const HeaderSpacer = styled(HeaderCell)`
  /* feature column header — blank to match Figma left column */
`;

const PlanTitle = styled.p`
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -1px;
  color: ${semantic.text.primary};
`;

const PriceRow = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  white-space: nowrap;
`;

const Amount = styled.span`
  font-size: 48px;
  line-height: 52px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.24px;
  color: ${semantic.text.primary};
`;

const Euro = styled.span`
  font-size: 24px;
  line-height: 30px;
  font-weight: 400;
  letter-spacing: -1px;
  color: #434343;
`;

const Freq = styled.span`
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: -0.25px;
  color: ${semantic.text.secondary};
`;

const SectionBlock = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const Cell = styled.div<{ $align?: 'left' | 'center'; $title?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.$align === 'center' ? 'center' : 'flex-start')};
  height: 72px;
  padding: 16px 12px 16px 0;
  box-sizing: border-box;
  border-bottom: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  font-size: ${(p) => (p.$title ? '18px' : '16px')};
  line-height: ${(p) => (p.$title ? '26px' : '24px')};
  font-weight: ${(p) => (p.$title ? fontWeight.bold : fontWeight.medium)};
  letter-spacing: ${(p) => (p.$title ? '-0.5px' : '-0.25px')};
  color: ${(p) => (p.$title ? semantic.text.primary : semantic.text.secondary)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Mobile = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  @media (min-width: 900px) {
    display: none;
  }
`;

const MobilePlanHead = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid ${semantic.border.primary};
`;

const MobilePlan = styled.div`
  text-align: center;
`;

const Accordion = styled.div`
  border-bottom: 1px solid ${semantic.border.primary};
`;

const AccordionHead = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 0;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 18px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.5px;
  color: ${semantic.text.primary};
  cursor: pointer;
  text-align: left;
`;

const FeatureBlock = styled.div`
  padding: 0 0 16px;
`;

const FeatureLabel = styled.div`
  font-size: 16px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.secondary};
  letter-spacing: -0.25px;
  margin-bottom: 8px;
`;

const PlanValueRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  font-size: 14px;
  color: ${semantic.text.secondary};
`;

function CellView({ cell }: { cell: CompareCell }) {
  if (cell.kind === 'check') {
    return (
      <Icon
        name="Check"
        size={24}
        weight="bold"
        color={semantic.status.success}
        aria-label="Included"
      />
    );
  }
  if (cell.kind === 'dash') {
    return <span aria-label="Not included">—</span>;
  }
  return <span>{cell.value}</span>;
}

/** Koala pricing table section — Figma `3141:52681`. */
export function ComparePricingTable({
  billing,
  sections,
  resolveCta: _resolveCta,
  onAction: _onAction,
  className,
}: ComparePricingTableProps) {
  const rows = sections ?? COMPARE_SECTIONS;
  const planCols = PRICING_GRID_SLUGS.map((slug) => getPlanDefinition(slug));
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rows.map((s) => [s.id, true])),
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const open = !prev[id];
      trackPricingEvent({ type: 'compare_section_expand', sectionId: id, open });
      return { ...prev, [id]: open };
    });
  };

  return (
    <Root className={className} aria-label="Compare plans">
      <Desktop>
        <Grid>
          <Col>
            <HeaderSpacer aria-hidden />
            {rows.map((section) => (
              <SectionBlock key={section.id}>
                <Cell $title>{section.title}</Cell>
                {section.rows.map((row) => (
                  <Cell key={row.id}>{row.label}</Cell>
                ))}
              </SectionBlock>
            ))}
          </Col>

          {planCols.map((plan) => (
            <Col key={plan.slug}>
              <HeaderCell>
                <PlanTitle>{plan.name}</PlanTitle>
                <PriceRow>
                  <Amount>{planDisplayPrice(plan, billing)}</Amount>
                  <Euro>€</Euro>
                  <Freq>/month</Freq>
                </PriceRow>
              </HeaderCell>
              {rows.map((section) => (
                <SectionBlock key={`${plan.slug}-${section.id}`}>
                  <Cell $align="center" aria-hidden />
                  {section.rows.map((row) => (
                    <Cell key={row.id} $align="center">
                      <CellView cell={row.cells[plan.slug]} />
                    </Cell>
                  ))}
                </SectionBlock>
              ))}
            </Col>
          ))}
        </Grid>
      </Desktop>

      <Mobile>
        <MobilePlanHead>
          {planCols.map((plan) => (
            <MobilePlan key={plan.slug}>
              <PlanTitle style={{ fontSize: 16, lineHeight: '22px' }}>{plan.name}</PlanTitle>
              <PriceRow style={{ justifyContent: 'center', marginTop: 8 }}>
                <Amount style={{ fontSize: 28, lineHeight: '32px' }}>{planDisplayPrice(plan, billing)}</Amount>
                <Euro style={{ fontSize: 16 }}>€</Euro>
                <Freq style={{ fontSize: 13 }}>/mo</Freq>
              </PriceRow>
            </MobilePlan>
          ))}
        </MobilePlanHead>

        {rows.map((section) => {
          const open = openSections[section.id] !== false;
          return (
            <Accordion key={section.id}>
              <AccordionHead
                type="button"
                aria-expanded={open}
                onClick={() => toggleSection(section.id)}
              >
                {section.title}
                <Icon name={open ? 'CaretUp' : 'CaretDown'} size={20} weight="bold" />
              </AccordionHead>
              {open ? (
                <div>
                  {section.rows.map((row) => (
                    <FeatureBlock key={row.id}>
                      <FeatureLabel>{row.label}</FeatureLabel>
                      {PRICING_GRID_SLUGS.map((slug) => (
                        <PlanValueRow key={slug}>
                          <span>{getPlanDefinition(slug).name}</span>
                          <CellView cell={row.cells[slug]} />
                        </PlanValueRow>
                      ))}
                    </FeatureBlock>
                  ))}
                </div>
              ) : null}
            </Accordion>
          );
        })}
      </Mobile>
    </Root>
  );
}

export default ComparePricingTable;
