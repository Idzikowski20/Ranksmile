// Shared react-query access to /api/content-settings (Brand Knowledge + Custom
// Voices). Replaces the per-component raw fetches so the same data is fetched once
// and cached/deduped across the editor, wizard and settings screens.
import { useMutation, useQuery, useQueryClient } from 'react-query';

export type ContentVoice = { id: string; name: string; description: string; isDefault: boolean };
export type ContentSettingsData = { voices: ContentVoice[]; brandKnowledge: string; brandName: string };

const KEY = 'content-settings';

export async function fetchContentSettings(): Promise<ContentSettingsData> {
   const res = await fetch('/api/content-settings');
   const d = await res.json().catch(() => ({}));
   return { voices: d.voices || [], brandKnowledge: d.brandKnowledge || '', brandName: d.brandName || '' };
}

export function useContentSettings() {
   return useQuery(KEY, fetchContentSettings, { staleTime: 60_000 });
}

/** PUT a partial update ({ brandKnowledge? , voices? }) and refresh the cache. */
export function useUpdateContentSettings() {
   const qc = useQueryClient();
   return useMutation(
      async (patch: Partial<{ brandKnowledge: string; brandName: string; voices: ContentVoice[] }>) => {
         const res = await fetch('/api/content-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
         });
         if (!res.ok) throw new Error('Failed to save content settings');
         return res.json();
      },
      { onSuccess: () => qc.invalidateQueries(KEY) },
   );
}
