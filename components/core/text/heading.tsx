import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {theme} from '../theme';
import {type BaseTextProps} from './text';

type HeadingSize = keyof typeof theme.font.size;
type ContentVariant = keyof typeof theme.tokens.content;

type BaseHeadingProps = Omit<BaseTextProps, 'bold' | 'uppercase'>;

export type HeadingProps = BaseHeadingProps & {
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  ref?: React.Ref<HTMLHeadingElement | null> | undefined;
  size?: HeadingSize;
  style?: React.CSSProperties;
} & Omit<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>,
    'style'
  >;

function getDefaultHeadingFontSize(as: HeadingProps['as']): HeadingSize {
  switch (as) {
    case 'h1':
      return '2xl';
    case 'h2':
      return 'xl';
    case 'h3':
      return 'lg';
    case 'h4':
      return 'md';
    case 'h5':
      return 'sm';
    case 'h6':
      return 'xs';
    default:
      return '2xl';
  }
}

export const Heading = styled(
  (props: HeadingProps & {className?: string}) => {
    const {children, as, ...rest} = props as HeadingProps;
    const HeadingComponent = as!;
    return <HeadingComponent {...(rest as any)}>{children}</HeadingComponent>;
  },
  {
    shouldForwardProp: p => isPropValid(p),
  }
)`
  ${p => {
    if (p.size) return `font-size: ${theme.font.size[p.size]};`;
    if (p.as) return `font-size: ${theme.font.size[getDefaultHeadingFontSize(p.as)]};`;
    return '';
  }}
  ${p => {
    if (!p.density) return '';
    const lh = p.density === 'compressed' ? 1 : 1.4;
    return `line-height: ${lh};`;
  }}
  ${p => p.align && `text-align: ${p.align};`}
  font-style: ${p => (p.italic ? 'italic' : undefined)};
  color: ${p => {
    if (p.variant === 'inherit') return undefined;
    const key = p.variant === 'muted' ? 'secondary' : (p.variant ?? 'primary');
    return theme.tokens.content[key as ContentVariant] ?? theme.tokens.content.headings;
  }};
  overflow: ${p => (p.ellipsis ? 'hidden' : undefined)};
  text-overflow: ${p => (p.ellipsis ? 'ellipsis' : undefined)};
  white-space: ${p => (p.wrap ? p.wrap : p.ellipsis ? 'nowrap' : undefined)};
  font-family: ${p => theme.font.family[p.monospace ? 'mono' : 'sans']};
  font-weight: ${p => {
    if (p.variant === 'inherit') return 'inherit';
    return theme.font.weight[p.monospace ? 'mono' : 'sans'].medium;
  }};
  margin: 0;
  padding: 0;
`;
