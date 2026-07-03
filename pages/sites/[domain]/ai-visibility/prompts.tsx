import type { NextPage } from 'next';
import ComingSoon from '../../../../components/aiVisibility/ComingSoon';

const AiVisibilityPrompts: NextPage = () => (
   <ComingSoon title="Prompts" blurb="Every tracked prompt with its per-engine visibility, grouped by topic. Available after your first scan completes." />
);

export default AiVisibilityPrompts;
