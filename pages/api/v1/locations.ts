// GET /api/v1/locations — content locations list the plugin fetches and caches.
// Mirrors the plugin's own hardcoded fallback format (semicolon-separated) so the
// stored option stays valid.
import type { NextApiRequest, NextApiResponse } from 'next';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

const LOCATIONS = 'Argentina;Australia;Austria;Belgium;Brazil;Bulgaria;Canada - EN;Canada - FR;Chile;China;Colombia;Croatia;Czech Republic;Denmark;Egypt;Estonia;Finland;France;Paris;Germany;Berlin;Hamburg;München;Greece;Hong Kong;Hungary;India;Indonesia;Ireland;Israel;Italy;Rome;Japan;Latvia;Lithuania;Malaysia;Mexico;Morocco;Netherlands;New Zealand;Nigeria;Norway;Pakistan;Peru;Philippines;Poland;Kraków;Warszawa;Wrocław;Portugal;Lisbon;Romania;Russia;Saudi Arabia;Serbia;Singapore;Slovakia;Slovenia;South Africa;South Korea;Spain;Sweden;Switzerland - DE;Switzerland - FR;Taiwan;Thailand;Turkey;Ukraine;United Arab Emirates;United Kingdom;London;United States;New York;Los Angeles;Chicago;Vietnam';

function handler(_req: NextApiRequest, res: NextApiResponse) {
   res.setHeader('Content-Type', 'text/plain; charset=utf-8');
   return res.status(200).send(LOCATIONS);
}

export default withOrgPaymentAccess(handler);
