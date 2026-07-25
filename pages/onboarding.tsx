import type { NextPage } from 'next';
import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import OnboardingShell from '../components/onboarding/OnboardingShell';
import OnboardingSurvey from '../components/onboarding/OnboardingSurvey';
import { useMarkOnboardingComplete } from '../lib/onboardingStatus';

const OnboardingPage: NextPage = () => {
   const router = useRouter();
   const markComplete = useMarkOnboardingComplete();
   const [submitting, setSubmitting] = useState(false);

   const handleFinish = async (answers: Record<string, string[]>) => {
      setSubmitting(true);
      try {
         await fetch('/api/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers }),
         });
         markComplete(true);
         router.replace('/plans');
      } catch {
         setSubmitting(false);
      }
   };

   return (
      <>
         <Head>
            <title>Get started · Ranksmile</title>
            <meta name="robots" content="noindex" />
         </Head>
         <OnboardingShell>
            <OnboardingSurvey onFinish={handleFinish} submitting={submitting} />
         </OnboardingShell>
      </>
   );
};

export default OnboardingPage;
