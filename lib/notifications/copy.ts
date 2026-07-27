import type { NotificationType } from './types';

export const OPTIMIZATION_TYPE: NotificationType = 'optimization_recommendation';

export function optimizationEventId(domainId: number): string {
  return `${OPTIMIZATION_TYPE}:domain:${domainId}`;
}

export function optimizationCopy(slug: string, domain: string, count: number): {
  title: string;
  body: string;
  href: string;
  payloadJson: string;
} {
  const plural = count > 1 ? 's' : '';
  return {
    title: 'New optimization recommendation',
    body: `You have ${count} new recommendation${plural} to optimize your content.`,
    href: `/sites/${slug}/recommendations`,
    payloadJson: JSON.stringify({ domain, slug }),
  };
}
