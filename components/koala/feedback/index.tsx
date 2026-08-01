import React from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/effects';
import { Spinner } from '../primitives/Spinner';

const Frame = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: ${spacing.lg};
  padding: ${spacing['3xl']} ${spacing.xl};
  font-family: ${typeface.body};
`;

const IconSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${semantic.text.tertiary};
  font-size: 32px;
  line-height: 1;
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${textScale.lg.fontSize};
  line-height: ${textScale.lg.lineHeight};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  letter-spacing: ${textScale.lg.letterSpacing};
`;

const Description = styled.p`
  margin: 0;
  max-width: 360px;
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  color: ${semantic.text.secondary};
  letter-spacing: ${textScale.sm.letterSpacing};
`;

const ActionSlot = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${spacing.lg};
  margin-top: ${spacing.md};
`;

export type FeedbackFrameProps = {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function FeedbackFrame({ icon, title, description, action, className }: FeedbackFrameProps) {
  return (
    <Frame className={className}>
      {icon ? <IconSlot>{icon}</IconSlot> : null}
      {title ? <Title>{title}</Title> : null}
      {description ? <Description>{description}</Description> : null}
      {action ? <ActionSlot>{action}</ActionSlot> : null}
    </Frame>
  );
}

export type EmptyStateProps = Omit<FeedbackFrameProps, 'icon'> & { icon?: React.ReactNode };

export function EmptyState(props: EmptyStateProps) {
  return <FeedbackFrame {...props} />;
}

export function ErrorState(props: FeedbackFrameProps) {
  return <FeedbackFrame {...props} />;
}

export function OfflineState(props: FeedbackFrameProps) {
  return <FeedbackFrame {...props} />;
}

export function PermissionState(props: FeedbackFrameProps) {
  return <FeedbackFrame {...props} />;
}

export function NoDataState(props: FeedbackFrameProps) {
  return <FeedbackFrame {...props} />;
}

export function RetryState(props: FeedbackFrameProps) {
  return <FeedbackFrame {...props} />;
}

const LoadingWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${spacing.lg};
  padding: ${spacing['3xl']} ${spacing.xl};
  font-family: ${typeface.body};
`;

const LoadingLabel = styled.span`
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  color: ${semantic.text.secondary};
`;

export type LoadingStateProps = {
  label?: string;
  className?: string;
  size?: number;
};

export function LoadingState({ label = 'Loading…', className, size = 24 }: LoadingStateProps) {
  return (
    <LoadingWrap className={className}>
      <Spinner size={size} />
      <LoadingLabel>{label}</LoadingLabel>
    </LoadingWrap>
  );
}

const shimmer = keyframes`
  0% { opacity: 0.55; }
  50% { opacity: 1; }
  100% { opacity: 0.55; }
`;

const Skeleton = styled.div<{ $width: string | number; $height: string | number }>`
  /* Fixed dimensions — never shifts layout while content loads. */
  width: ${(p) => (typeof p.$width === 'number' ? `${p.$width}px` : p.$width)};
  height: ${(p) => (typeof p.$height === 'number' ? `${p.$height}px` : p.$height)};
  flex-shrink: 0;
  border-radius: ${radius.sm};
  background: ${semantic.background.secondary};
  animation: ${shimmer} 1.4s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.7;
  }
`;

export type SkeletonBoxProps = {
  width: string | number;
  height: string | number;
  className?: string;
};

export function SkeletonBox({ width, height, className }: SkeletonBoxProps) {
  return <Skeleton className={className} $width={width} $height={height} aria-hidden="true" />;
}
