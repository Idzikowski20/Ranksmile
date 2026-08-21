import type { NextPage } from 'next';
import { AiTrackingPage } from '../components/aiTracking/AiTrackingPage';

// Public marketing page — no auth gate (registered in lib/isPublicPath + accessPolicy).
const AiVisibilityTracking: NextPage = () => <AiTrackingPage />;
export default AiVisibilityTracking;
