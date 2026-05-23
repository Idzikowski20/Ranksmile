/** Convert URL-safe slug back to domain name */
export function slugToDomain(slug: string): string {
   return slug.replaceAll('-', '.').replaceAll('_', '-');
}
