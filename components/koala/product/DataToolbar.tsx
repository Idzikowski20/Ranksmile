import React from 'react';
import styled from '@emotion/styled';
import Input from '../primitives/Input';
import Button from '../primitives/Button';
import { Icon } from '../icons';
import { semantic } from '../tokens/semantic';
import { spacing } from '../tokens/spacing';
import { greyNeutral } from '../tokens/colors';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { radius } from '../tokens/effects';

const Root = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding: ${spacing.lg} 0;
`;

const Left = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
`;

const SearchWrap = styled.div`
  position: relative;
  flex: 0 1 312px;
  min-width: 180px;
  max-width: 312px;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  color: ${greyNeutral[500]};
  pointer-events: none;
`;

const KbdHint = styled.span`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid ${semantic.border.primary};
  border-radius: 6px;
  padding: 2px 6px;
  font-family: ${typeface.body};
  font-size: ${textScale.xs.fontSize};
  line-height: ${textScale.xs.lineHeight};
  font-weight: ${fontWeight.bold};
  color: ${greyNeutral[600]};
  pointer-events: none;
`;

const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
`;

const SelectionLabel = styled.span`
  font-family: ${typeface.body};
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  white-space: nowrap;
`;

const IconBtn = styled(Button)`
  width: 36px;
  min-width: 36px;
  padding: 8px !important;
  border-radius: ${radius.button.default};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
`;

export type DataToolbarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Keyboard shortcut badge inside search (e.g. ⌘K). */
  shortcutHint?: string;
  filters?: React.ReactNode;
  /** Figma simple left: funnel + sort icon buttons. */
  onFilterClick?: () => void;
  onSortClick?: () => void;
  actions?: React.ReactNode;
  /** When > 0, toolbar enters selection mode (Figma Item Selected). */
  selectionCount?: number;
  selectionLabel?: string;
  selectionActions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function DataToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search for anything',
  shortcutHint,
  filters,
  onFilterClick,
  onSortClick,
  actions,
  selectionCount = 0,
  selectionLabel,
  selectionActions,
  children,
  className,
}: DataToolbarProps) {
  const showSearch = onSearchChange !== undefined;
  const selected = selectionCount > 0;
  const showSimpleTools = !selected && (onFilterClick != null || onSortClick != null);

  return (
    <Root className={className} data-toolbar-state={selected ? 'selected' : 'default'}>
      <Left>
        {selected ? (
          <SelectionLabel>
            {selectionLabel ?? `${selectionCount} ${selectionCount === 1 ? 'item' : 'items'} selected`}
          </SelectionLabel>
        ) : (
          <>
            {showSearch ? (
              <SearchWrap>
                <SearchIcon>
                  <Icon name="MagnifyingGlass" size={20} />
                </SearchIcon>
                <Input
                  size="sm"
                  value={searchValue ?? ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  style={{
                    paddingLeft: 36,
                    paddingRight: shortcutHint ? 44 : undefined,
                    width: '100%',
                    borderColor: semantic.input.border,
                    borderRadius: 12,
                    boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
                  }}
                />
                {shortcutHint ? <KbdHint aria-hidden>{shortcutHint}</KbdHint> : null}
              </SearchWrap>
            ) : null}
            {showSimpleTools ? (
              <Filters>
                {onFilterClick ? (
                  <IconBtn
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Filter"
                    onClick={onFilterClick}
                    icon={<Icon name="FunnelSimple" size={20} />}
                  />
                ) : null}
                {onSortClick ? (
                  <IconBtn
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Sort"
                    onClick={onSortClick}
                    icon={<Icon name="ArrowsDownUp" size={20} />}
                  />
                ) : null}
              </Filters>
            ) : null}
            {!selected && filters ? <Filters>{filters}</Filters> : null}
          </>
        )}
        {children}
      </Left>
      <Actions>
        {selected && selectionActions ? selectionActions : actions}
      </Actions>
    </Root>
  );
}

export default DataToolbar;
