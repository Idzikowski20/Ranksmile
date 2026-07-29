import { hashDocument } from './aoBaseline';
import type { AoScores } from './aoScoreDelta';

export type AoDocumentSnapshot = {
  html: string;
  hash: string;
  scores: AoScores;
};

export function makeSnapshot(html: string, scores: AoScores): AoDocumentSnapshot {
  return {
    html,
    hash: hashDocument(html),
    scores: { ...scores },
  };
}

export function cloneSnapshot(s: AoDocumentSnapshot): AoDocumentSnapshot {
  return {
    html: s.html,
    hash: s.hash,
    scores: { ...s.scores },
  };
}
