import React from 'react';
import { ChatGptIcon, GoogleG, PerplexityIcon } from '../aiVisibility/modelIcons';

export type AiBotStatus = 'good' | 'blocked';

export type AiBot = {
  id: string;
  label: string;
  extended?: boolean;
};

export const PRIMARY_BOTS: AiBot[] = [
  { id: 'chatgpt-user', label: 'ChatGPT-User' },
  { id: 'oai-searchbot', label: 'OAI-SearchBot' },
  { id: 'googlebot', label: 'Googlebot' },
  { id: 'google-extended', label: 'Google-Extended' },
];

export const EXTENDED_BOTS: AiBot[] = [
  { id: 'perplexity-bot', label: 'PerplexityBot', extended: true },
  { id: 'perplexity-user', label: 'Perplexity-User', extended: true },
  { id: 'claude-user', label: 'Claude-User', extended: true },
  { id: 'claude-searchbot', label: 'Claude-SearchBot', extended: true },
];

function ClaudeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M32 16.032C27.8484 16.2868 23.9332 18.0509 20.9921 20.9921C18.0509 23.9332 16.2868 27.8484 16.032 32H15.968C15.7136 27.8482 13.9497 23.9328 11.0084 20.9916C8.06716 18.0503 4.15176 16.2864 0 16.032L0 15.968C4.15176 15.7136 8.06716 13.9497 11.0084 11.0084C13.9497 8.06716 15.7136 4.15176 15.968 0L16.032 0C16.2868 4.15162 18.0509 8.06677 20.9921 11.0079C23.9332 13.9491 27.8484 15.7132 32 15.968V16.032Z"
        fill="#C15F3C"
      />
    </svg>
  );
}

function ColoredGoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" />
      <path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" />
      <path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC05" />
      <path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" />
    </svg>
  );
}

export function BotIcon({ botId, size = 16 }: { botId: string; size?: number }) {
  const wrap = (node: React.ReactNode) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, flexShrink: 0 }}>
      {node}
    </span>
  );

  if (botId.startsWith('chatgpt') || botId.startsWith('oai')) {
    return wrap(<span style={{ color: '#18181B' }}><ChatGptIcon size={size} /></span>);
  }
  if (botId.startsWith('google')) {
    return wrap(<ColoredGoogleIcon size={size} />);
  }
  if (botId.startsWith('perplexity')) {
    return wrap(<span style={{ color: '#20B8CD' }}><PerplexityIcon size={size} /></span>);
  }
  if (botId.startsWith('claude')) {
    return wrap(<ClaudeIcon size={size} />);
  }
  return wrap(<span style={{ color: '#9F9FA9' }}><GoogleG size={size} /></span>);
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M13.707 3.793a1 1 0 0 1 0 1.414l-6.996 7a1 1 0 0 1-1.414 0L2.293 9.2a1 1 0 0 1 1.414-1.414l2.297 2.3 6.289-6.292a1 1 0 0 1 1.414 0Z" clipRule="evenodd" />
    </svg>
  );
}

export function BotRow({ bot, status = 'good' }: { bot: AiBot; status?: AiBotStatus }) {
  const good = status === 'good';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <BotIcon botId={bot.id} />
        <span style={{ color: '#18181B' }}>{bot.label}</span>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: good ? '#1AB25E' : '#FF6F77', fontSize: 12, flexShrink: 0 }}>
        {good && <CheckIcon />}
        {good ? 'All good' : 'Blocked'}
      </span>
    </div>
  );
}
