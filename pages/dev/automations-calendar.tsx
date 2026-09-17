import React, { useState } from 'react';
import Head from 'next/head';
import type { GetServerSideProps, NextPage } from 'next';
import type { AutomationEvent, AutomationEventStatus, AutomationPublishMode } from '@/src/core/shared/types/automations';
import AutomationsBoard from '../../components/automations/AutomationsBoard';

let seq = 0;
const ev = (date: string, title: string, status: AutomationEventStatus, mode: AutomationPublishMode = 'draft'): AutomationEvent => {
  seq += 1;
  return {
    id: seq, domainId: 1, workspaceId: 1, scheduledDate: date, title, targetKeyword: 'figma components',
    publishMode: mode, articleId: status === 'scheduled' ? null : seq, status, createdAt: null,
  };
};

/** The week from the Koala Content Calendar reference, as automation events. */
const FIXTURE: AutomationEvent[] = [
  ev('2024-12-16', "Beginner's Guide to Crafting Figma Components", 'created'),
  ev('2024-12-16', 'Getting Started: Building Figma Components Using Boolean Types', 'scheduled', 'live'),
  ev('2024-12-16', 'Figma Basics: How to Use Boolean Types for Component Creation', 'generating'),
  ev('2024-12-18', 'Figma Component Creation for Beginners: Boolean Types', 'scheduled'),
  ev('2024-12-18', 'How to Use Boolean Types in Figma: A Beginner’s Tutorial', 'generating', 'live'),
  ev('2024-12-18', "Creating Figma Components: A Beginner's Approach", 'published', 'live'),
  ev('2024-12-18', 'Figma 101: Crafting Components with Boolean Logic for Newbies', 'published', 'live'),
  ev('2024-12-18', "A Beginner's Path to Figma: Making Components", 'created'),
  ev('2024-12-19', 'Figma for Beginners: Building Components with Boolean', 'generating'),
  ev('2024-12-19', "How to Design Figma Components: A Beginner's Guide", 'published', 'live'),
  ev('2024-12-19', "Mastering Figma: Beginner's Tips for Creating Components", 'scheduled'),
  ev('2024-12-19', 'Figma Component Basics: Using Boolean Types for Beginners', 'created'),
  ev('2024-12-20', 'Understanding Figma Variants for Design Systems', 'failed', 'live'),
  ev('2024-12-20', 'Figma Auto Layout Explained Simply', 'scheduled'),
];

/** Dev-only stub for the Automations content calendar (no auth). */
const AutomationsCalendarStub: NextPage = () => {
  const [anchor, setAnchor] = useState(() => new Date(2024, 11, 18));
  const [events, setEvents] = useState(FIXTURE);
  return (
    <>
      <Head>
        <title>Automations calendar — Ranksmile dev</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main style={{ minHeight: '100vh', background: 'var(--koala-bg-primary)', padding: '32px 40px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', fontFamily: 'var(--font-family-primary)' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--koala-text-primary)' }}>Automations</h1>
          <p style={{ margin: '6px 0 24px', fontSize: 14, color: 'var(--koala-text-secondary)' }}>
            Plan the week — each scheduled event writes its article on the day and, for live events, publishes it to WordPress.
          </p>
          <AutomationsBoard
            weekAnchor={anchor}
            events={events}
            onPrevWeek={() => setAnchor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
            onNextWeek={() => setAnchor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
            onThisWeek={() => setAnchor(new Date(2024, 11, 18))}
            onAdd={() => {}}
            onDayAdd={() => {}}
            onEventClick={() => {}}
            onEventDelete={(e) => setEvents((list) => list.filter((x) => x.id !== e.id))}
          />
        </div>
      </main>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_KOALA_GALLERY !== '1') {
    return { notFound: true };
  }
  return { props: {} };
};

export default AutomationsCalendarStub;
