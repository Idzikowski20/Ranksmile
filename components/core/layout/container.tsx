import type {CSSProperties} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {theme} from '../theme';

// ── Types ────────────────────────────────────────────────────────────────────
type SpaceSize = keyof typeof theme.space;
type RadiusSize = keyof typeof theme.radius;
type BorderVariant = keyof typeof theme.border;
type SurfaceVariant = keyof typeof theme.tokens.background;
type TextSize = keyof typeof theme.font.size;
type ContentVariant = keyof typeof theme.tokens.content;

type Responsive<T> = T | {[K in string]?: T};
type Shorthand<T, N extends number> = T | T[] & {length: N};
type ContainerElement = keyof Pick<JSX.IntrinsicElements, 'div' | 'span' | 'section' | 'article' | 'aside' | 'nav' | 'header' | 'footer' | 'main' | 'ul' | 'ol' | 'li' | 'p' | 'button' | 'a' | 'img' | 'input' | 'label' | 'form'>;

interface ContainerLayoutProps {
  background?: Responsive<Exclude<SurfaceVariant, 'overlay'>>;
  display?: Responsive<
    'block' | 'inline' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid' | 'contents' | 'none'
  >;
  padding?: Responsive<Shorthand<SpaceSize, 4>>;
  paddingTop?: Responsive<SpaceSize>;
  paddingBottom?: Responsive<SpaceSize>;
  paddingLeft?: Responsive<SpaceSize>;
  paddingRight?: Responsive<SpaceSize>;
  position?: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>;
  top?: Responsive<CSSProperties['top']>;
  bottom?: Responsive<CSSProperties['bottom']>;
  left?: Responsive<CSSProperties['left']>;
  right?: Responsive<CSSProperties['right']>;
  overflow?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowX?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowY?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  pointerEvents?: Responsive<CSSProperties['pointerEvents']>;
  cursor?: Responsive<CSSProperties['cursor']>;
  radius?: Responsive<Shorthand<RadiusSize, 4>>;
  width?: Responsive<CSSProperties['width']>;
  minWidth?: Responsive<CSSProperties['minWidth']>;
  maxWidth?: Responsive<CSSProperties['maxWidth']>;
  height?: Responsive<CSSProperties['height']>;
  minHeight?: Responsive<CSSProperties['minHeight']>;
  maxHeight?: Responsive<CSSProperties['maxHeight']>;
  border?: Responsive<BorderVariant>;
  borderTop?: Responsive<BorderVariant>;
  borderBottom?: Responsive<BorderVariant>;
  borderLeft?: Responsive<BorderVariant>;
  borderRight?: Responsive<BorderVariant>;
  alignItems?: Responsive<CSSProperties['alignItems']>;
  justifyContent?: Responsive<CSSProperties['justifyContent']>;
  flex?: Responsive<CSSProperties['flex']>;
  flexBasis?: Responsive<CSSProperties['flexBasis']>;
  flexGrow?: Responsive<CSSProperties['flexGrow']>;
  flexShrink?: Responsive<CSSProperties['flexShrink']>;
  flexDirection?: Responsive<CSSProperties['flexDirection']>;
  flexWrap?: Responsive<CSSProperties['flexWrap']>;
  gridArea?: Responsive<CSSProperties['gridArea']>;
  gridAutoColumns?: Responsive<CSSProperties['gridAutoColumns']>;
  gridAutoFlow?: Responsive<CSSProperties['gridAutoFlow']>;
  gridAutoRows?: Responsive<CSSProperties['gridAutoRows']>;
  gridColumn?: Responsive<CSSProperties['gridColumn']>;
  gridRow?: Responsive<CSSProperties['gridRow']>;
  gridTemplateAreas?: Responsive<CSSProperties['gridTemplateAreas']>;
  gridTemplateColumns?: Responsive<CSSProperties['gridTemplateColumns']>;
  gridTemplateRows?: Responsive<CSSProperties['gridTemplateRows']>;
  justifyItems?: Responsive<CSSProperties['justifyItems']>;
  justifySelf?: Responsive<CSSProperties['justifySelf']>;
  alignItemsGrid?: Responsive<CSSProperties['alignItems']>;
  alignContent?: Responsive<CSSProperties['alignContent']>;
  alignSelf?: Responsive<CSSProperties['alignSelf']>;
  placeItems?: Responsive<CSSProperties['placeItems']>;
  order?: Responsive<CSSProperties['order']>;
  gap?: Responsive<SpaceSize | `${SpaceSize} ${SpaceSize}`>;
  zIndex?: Responsive<CSSProperties['zIndex']>;
  opacity?: Responsive<CSSProperties['opacity']>;
  visibility?: Responsive<CSSProperties['visibility']>;
  margin?: Responsive<CSSProperties['margin']>;
  marginTop?: Responsive<CSSProperties['marginTop']>;
  marginBottom?: Responsive<CSSProperties['marginBottom']>;
  marginLeft?: Responsive<CSSProperties['marginLeft']>;
  marginRight?: Responsive<CSSProperties['marginRight']>;
  transition?: Responsive<CSSProperties['transition']>;
  transform?: Responsive<CSSProperties['transform']>;
  animation?: Responsive<CSSProperties['animation']>;
  filter?: Responsive<CSSProperties['filter']>;
  backdropFilter?: Responsive<CSSProperties['backdropFilter']>;
  boxShadow?: Responsive<CSSProperties['boxShadow']>;
  textAlign?: Responsive<CSSProperties['textAlign']>;
  textOverflow?: Responsive<CSSProperties['textOverflow']>;
  whiteSpace?: Responsive<CSSProperties['whiteSpace']>;
  textTransform?: Responsive<CSSProperties['textTransform']>;
  color?: Responsive<CSSProperties['color']>;
  backgroundColor?: Responsive<CSSProperties['backgroundColor']>;
  fill?: Responsive<CSSProperties['fill']>;
  stroke?: Responsive<CSSProperties['stroke']>;
  outline?: Responsive<CSSProperties['outline']>;
}

export interface ContainerProps<T extends ContainerElement = 'div'>
  extends Omit<ContainerLayoutProps, 'color' | 'backgroundColor'> {
  as?: T;
  ref?: React.Ref<HTMLElementTagNameMap[T]>;
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: React.MouseEventHandler<HTMLElementTagNameMap[T]>;
  onMouseEnter?: React.MouseEventHandler<HTMLElementTagNameMap[T]>;
  onMouseLeave?: React.MouseEventHandler<HTMLElementTagNameMap[T]>;
  onMouseDown?: React.MouseEventHandler<HTMLElementTagNameMap[T]>;
  onMouseUp?: React.MouseEventHandler<HTMLElementTagNameMap[T]>;
  onFocus?: React.FocusEventHandler<HTMLElementTagNameMap[T]>;
  onBlur?: React.FocusEventHandler<HTMLElementTagNameMap[T]>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElementTagNameMap[T]>;
  onKeyUp?: React.KeyboardEventHandler<HTMLElementTagNameMap[T]>;
  tabIndex?: number;
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-hidden'?: boolean;
  'data-testId'?: string;
  id?: string;
}

export type ContainerPropsWithRenderFunction<T extends ContainerElement = 'div'> = Omit<
  ContainerProps<T>,
  'children'
> & {
  children: (props: {className: string}) => React.ReactNode | undefined;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function resolveSpacing(v: SpaceSize): string {
  return theme.space[v];
}
function resolveRadius(v: RadiusSize): string {
  return theme.radius[v];
}
function resolveBorder(v: BorderVariant): string {
  return `${theme.border[v]} solid ${theme.tokens.border.primary}`;
}
function resolveSurface(v: SurfaceVariant): string {
  const bg = theme.tokens.background[v as keyof typeof theme.tokens.background];
  return typeof bg === 'string' ? bg : '#FFFFFF';
}

// ── Container ─────────────────────────────────────────────────────────────────
export const Container = styled('div', {
  shouldForwardProp: p => isPropValid(p) && !p.startsWith('$'),
})<ContainerLayoutProps & {className?: string}>`
  ${p => p.background && `background: ${resolveSurface(p.background as SurfaceVariant)};`}
  ${p => p.display && `display: ${p.display};`}
  ${p => p.position && `position: ${p.position};`}
  ${p => p.top != null && `top: ${p.top};`}
  ${p => p.bottom != null && `bottom: ${p.bottom};`}
  ${p => p.left != null && `left: ${p.left};`}
  ${p => p.right != null && `right: ${p.right};`}
  ${p => p.overflow && `overflow: ${p.overflow};`}
  ${p => p.overflowX && `overflow-x: ${p.overflowX};`}
  ${p => p.overflowY && `overflow-y: ${p.overflowY};`}
  ${p => p.pointerEvents && `pointer-events: ${p.pointerEvents};`}
  ${p => p.cursor && `cursor: ${p.cursor};`}
  ${p => p.width != null && `width: ${typeof p.width === 'number' ? `${p.width}px` : p.width};`}
  ${p => p.minWidth != null && `min-width: ${typeof p.minWidth === 'number' ? `${p.minWidth}px` : p.minWidth};`}
  ${p => p.maxWidth != null && `max-width: ${typeof p.maxWidth === 'number' ? `${p.maxWidth}px` : p.maxWidth};`}
  ${p => p.height != null && `height: ${typeof p.height === 'number' ? `${p.height}px` : p.height};`}
  ${p => p.minHeight != null && `min-height: ${typeof p.minHeight === 'number' ? `${p.minHeight}px` : p.minHeight};`}
  ${p => p.maxHeight != null && `max-height: ${typeof p.maxHeight === 'number' ? `${p.maxHeight}px` : p.maxHeight};`}
  ${p => p.padding && `padding: ${typeof p.padding === 'string' ? resolveSpacing(p.padding as SpaceSize) : p.padding};`}
  ${p => p.paddingTop && `padding-top: ${resolveSpacing(p.paddingTop as SpaceSize)};`}
  ${p => p.paddingBottom && `padding-bottom: ${resolveSpacing(p.paddingBottom as SpaceSize)};`}
  ${p => p.paddingLeft && `padding-left: ${resolveSpacing(p.paddingLeft as SpaceSize)};`}
  ${p => p.paddingRight && `padding-right: ${resolveSpacing(p.paddingRight as SpaceSize)};`}
  ${p => p.radius && `border-radius: ${typeof p.radius === 'string' ? resolveRadius(p.radius as RadiusSize) : p.radius};`}
  ${p => p.border && `border: ${resolveBorder(p.border as BorderVariant)};`}
  ${p => p.borderTop && `border-top: ${resolveBorder(p.borderTop as BorderVariant)};`}
  ${p => p.borderBottom && `border-bottom: ${resolveBorder(p.borderBottom as BorderVariant)};`}
  ${p => p.borderLeft && `border-left: ${resolveBorder(p.borderLeft as BorderVariant)};`}
  ${p => p.borderRight && `border-right: ${resolveBorder(p.borderRight as BorderVariant)};`}
  ${p => p.gap && `gap: ${typeof p.gap === 'string' ? resolveSpacing(p.gap as SpaceSize) : p.gap};`}
  ${p => p.flexDirection && `flex-direction: ${p.flexDirection};`}
  ${p => p.flexWrap && `flex-wrap: ${p.flexWrap};`}
  ${p => p.flex && `flex: ${p.flex};`}
  ${p => p.alignItems && `align-items: ${p.alignItems};`}
  ${p => p.justifyContent && `justify-content: ${p.justifyContent};`}
  ${p => p.gridTemplateColumns && `grid-template-columns: ${p.gridTemplateColumns};`}
  ${p => p.gridTemplateRows && `grid-template-rows: ${p.gridTemplateRows};`}
  ${p => p.gridArea && `grid-area: ${p.gridArea};`}
  ${p => p.gridColumn && `grid-column: ${p.gridColumn};`}
  ${p => p.gridRow && `grid-row: ${p.gridRow};`}
  ${p => p.order != null && `order: ${p.order};`}
  ${p => p.zIndex != null && `z-index: ${p.zIndex};`}
  ${p => p.opacity != null && `opacity: ${p.opacity};`}
  ${p => p.margin != null && `margin: ${p.margin};`}
  ${p => p.marginTop != null && `margin-top: ${p.marginTop};`}
  ${p => p.marginBottom != null && `margin-bottom: ${p.marginBottom};`}
  ${p => p.marginLeft != null && `margin-left: ${p.marginLeft};`}
  ${p => p.marginRight != null && `margin-right: ${p.marginRight};`}
  ${p => p.boxShadow && `box-shadow: ${p.boxShadow};`}
  ${p => p.textAlign && `text-align: ${p.textAlign};`}
  ${p => p.textOverflow && `text-overflow: ${p.textOverflow};`}
  ${p => p.whiteSpace && `white-space: ${p.whiteSpace};`}
  ${p => p.textTransform && `text-transform: ${p.textTransform};`}
  ${p => p.transition && `transition: ${p.transition};`}
  ${p => p.transform && `transform: ${p.transform};`}
  ${p => p.animation && `animation: ${p.animation};`}
  ${p => p.filter && `filter: ${p.filter};`}
  ${p => p.outline && `outline: ${p.outline};`}
  box-sizing: border-box;
  margin: 0;
` as unknown as <T extends ContainerElement = 'div'>(
  props: ContainerProps<T> | ContainerPropsWithRenderFunction<T>
) => React.ReactElement;
