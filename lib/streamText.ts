/**
 * Cap for the generation stream stored on a job row. The append itself happens in SQL
 * (see job-progress) so overlapping chunk callbacks cannot lose each other.
 *
 * ponytail: the cut is a raw character boundary, so an article that ever reaches this
 * length is delivered truncated and possibly mid-tag. Upgrade path: cut at a tag
 * boundary and flag the job as truncated so the editor can warn instead of presenting
 * a partial document as finished.
 */
export const MAX_STREAM_CHARS = 400_000;
