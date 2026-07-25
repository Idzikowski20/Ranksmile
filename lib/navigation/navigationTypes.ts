export type NavigationSection = 'seo' | 'tools' | 'aiVisibility';

/** Path segment(s) under `/sites/{slug}/`. */
export type SiteNavItem = {
  id: string;
  label: string;
  path: string;
  /** Suffix passed to path.includes / endsWith matchers. */
  match: string;
  keywords?: string[];
};
