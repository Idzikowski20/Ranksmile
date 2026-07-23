import type { Capability } from './types';

/** What the platform can do — agents/MCP query this instead of scanning the repo. */
export const PLATFORM_CAPABILITIES: Capability[] = [
  {
    id: 'create_outline',
    label: 'Create Outline',
    description: 'Generate an H2/H3 outline from keyword + SERP context',
    actionTypes: ['create_outline'],
    available: true,
  },
  {
    id: 'rewrite_section',
    label: 'Rewrite Section',
    description: 'Surgical LLM edit of one article section (Auto-Optimize)',
    actionTypes: ['rewrite_section', 'expand_section', 'fix_heading'],
    available: true,
  },
  {
    id: 'generate_faq',
    label: 'Generate FAQ',
    description: 'Append FAQ block covering uncovered AI Search questions',
    actionTypes: ['add_faq', 'cover_question'],
    available: true,
  },
  {
    id: 'cluster_entities',
    label: 'Cluster Entities',
    description: 'Group entities for coverage / topical map (fill in Q2)',
    actionTypes: ['add_entity', 'cluster_entities'],
    available: false,
  },
  {
    id: 'suggest_internal_links',
    label: 'Suggest Internal Links',
    description: 'Propose internal links from Knowledge Layer pages',
    actionTypes: ['add_internal_link'],
    available: true,
  },
  {
    id: 'analyze_competitors',
    label: 'Analyze Competitors',
    description: 'SERP / AI Visibility competitor gap analysis',
    actionTypes: ['analyze_competitors'],
    available: true,
  },
  {
    id: 'generate_brief',
    label: 'Generate Brief',
    description: 'Content brief from Observations + Knowledge Layer',
    actionTypes: ['generate_brief'],
    available: true,
  },
  {
    id: 'run_auto_optimize',
    label: 'Run Auto-Optimize',
    description: 'Full-article or section AO pipeline',
    actionTypes: ['rewrite_section', 'expand_section', 'add_faq'],
    available: true,
  },
  {
    id: 'publish_wordpress',
    label: 'Publish to WordPress',
    description: 'Propose publish via WP plugin (user confirms)',
    actionTypes: ['publish'],
    available: true,
  },
];

export function listCapabilities(onlyAvailable = false): Capability[] {
  return onlyAvailable
    ? PLATFORM_CAPABILITIES.filter((c) => c.available)
    : [...PLATFORM_CAPABILITIES];
}

export function getCapability(id: string): Capability | undefined {
  return PLATFORM_CAPABILITIES.find((c) => c.id === id);
}
