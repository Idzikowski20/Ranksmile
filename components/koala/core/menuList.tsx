import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radius, shadow } from '../tokens/effects';

/**
 * MenuList — Koala dropdown panel shell (header / search / items / footer).
 * Modal stack: use inside Popover or Select — never nest a Dialog under another Dialog.
 */

const Root = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 200px;
  max-width: min(360px, calc(100vw - 24px));
  background: ${semantic.card.bg};
  border: 1px solid ${semantic.card.border};
  border-radius: ${radius.card.default};
  box-shadow: ${shadow.md};
  overflow: hidden;
  font-family: ${typeface.body};
`;

const Header = styled.div`
  padding: ${spacing.md} ${spacing.lg};
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  border-bottom: 1px solid ${semantic.border.primary};
`;

const Search = styled.div`
  padding: ${spacing.sm} ${spacing.md};
  border-bottom: 1px solid ${semantic.border.primary};
`;

const Body = styled.div`
  padding: ${spacing.xs};
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const Footer = styled.div`
  padding: ${spacing.sm} ${spacing.md};
  border-top: 1px solid ${semantic.border.primary};
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

export type MenuListProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  search?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  role?: string;
};

export function MenuList({ children, header, search, footer, className, role = 'menu' }: MenuListProps) {
  return (
    <Root className={`koala-menu-list ${className ?? ''}`.trim()} role={role}>
      {header ? <Header className="koala-menu-list__header">{header}</Header> : null}
      {search ? <Search className="koala-menu-list__search">{search}</Search> : null}
      <Body className="koala-menu-list__body koala-menu-list">{children}</Body>
      {footer ? <Footer className="koala-menu-list__footer">{footer}</Footer> : null}
    </Root>
  );
}

export default MenuList;
