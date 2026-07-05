// Relevance filter for organic competitors. The SERP top-10 for an informational
// keyword often includes non-article hosts (streaming, social, video, translation,
// app stores) that are useless as content-audit peers — SurferSEO drops them. We filter
// them out Node-side (no sidecar redeploy) before storing/using competitors.

// Hosts that are never a content-article competitor. Matched as a suffix on the bare
// host (so `open.spotify.com` and `spotify.com` both match `spotify.com`). Shops are
// already dropped by the sidecar; this list targets media / social / tools / app stores.
const NON_CONTENT_HOSTS = [
   'spotify.com', 'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'soundcloud.com',
   'facebook.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'linkedin.com',
   'pinterest.com', 'pinterest.pl', 'reddit.com', 'quora.com',
   'reverso.net', 'translate.google.com',
   // App stores + Google/Apple non-article surfaces — specific subdomains only, so real
   // content on support.google.com / developer.apple.com etc. still counts as a competitor.
   'play.google.com', 'apps.apple.com', 'itunes.apple.com', 'maps.google.com',
];

const bareHost = (host: string): string => host.replace(/^www\./, '').toLowerCase();

/** Bare host of a competitor (from its stored domain, else derived from its URL). */
export function hostOf(domain: string, url: string): string {
   if (domain) return bareHost(domain);
   try { return bareHost(new URL(url).hostname); } catch { return ''; }
}

/** True when a host is a plausible content-article competitor (not media/social/tools). */
export function isContentCompetitor(domain: string, url: string): boolean {
   const host = hostOf(domain, url);
   if (!host) return false;
   return !NON_CONTENT_HOSTS.some((bad) => host === bad || host.endsWith(`.${bad}`));
}
