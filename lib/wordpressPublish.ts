// WordPress REST API client for publishing articles

export interface WPPublishOptions {
   wpUrl: string;          // e.g. https://myblog.com
   apiKey: string;         // WordPress Application Password (base64: user:password)
   title: string;
   content: string;        // HTML
   slug?: string;
   excerpt?: string;
   status?: 'draft' | 'publish' | 'pending';
   schemaJson?: object;
}

export interface WPPublishResult {
   id: number;
   link: string;
   status: string;
}

export async function publishToWordPress(opts: WPPublishOptions): Promise<WPPublishResult> {
   const { wpUrl, apiKey, title, content, slug, excerpt, status = 'publish', schemaJson } = opts;

   // Inject JSON-LD schema into content if provided
   let finalContent = content;
   if (schemaJson) {
      const schemaBlock = `<script type="application/ld+json">${JSON.stringify(schemaJson, null, 2)}</script>\n`;
      finalContent = schemaBlock + content;
   }

   const endpoint = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;

   const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`,
      },
      body: JSON.stringify({
         title,
         content: finalContent,
         status,
         slug: slug || '',
         excerpt: excerpt || '',
      }),
   });

   if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`WordPress API error ${response.status}: ${errorBody}`);
   }

   const data = await response.json();
   return {
      id: data.id,
      link: data.link,
      status: data.status,
   };
}

export async function publishToNextJs(opts: {
   endpointUrl: string;
   apiKey: string;
   title: string;
   content: string;
   slug?: string;
   description?: string;
   schema?: object;
}): Promise<{ url: string }> {
   const { endpointUrl, apiKey, title, content, slug, description, schema } = opts;

   const response = await fetch(`${endpointUrl.replace(/\/$/, '')}/api/publish`, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ title, content, slug, description, schema }),
   });

   if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Next.js publish error ${response.status}: ${errorBody}`);
   }

   return response.json();
}
