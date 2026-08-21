import type { NextPage } from 'next';
import LandingPage from '../../components/landing/LandingPage';

// Throwaway: renders the marketing landing with no auth gate so it can be
// screenshotted in dev. Deleted before commit.
const LandingPreview: NextPage = () => <LandingPage />;
export default LandingPreview;
