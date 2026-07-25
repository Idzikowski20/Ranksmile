import {
  splitRanksmileThinkingAndMessage,
  shouldShowRanksmileAnswerStream,
  shouldShowRanksmileThinkingDisclosure,
} from '../../../lib/ai/text';

describe('splitRanksmileThinkingAndMessage', () => {
  it('splits thinking vs answer at thinkingLen', () => {
    const streamed = 'Planuję edycję.\nMeta gotowa.';
    const thinkingLen = 'Planuję edycję.\n'.length;
    expect(splitRanksmileThinkingAndMessage(streamed, thinkingLen)).toEqual({
      thinking: 'Planuję edycję.',
      message: 'Meta gotowa.',
    });
  });

  it('does not fall back to full text when answer slice is empty', () => {
    const streamed = 'Teraz skrócę akapity i sprawdzę score.';
    const thinkingLen = streamed.length;
    expect(splitRanksmileThinkingAndMessage(streamed, thinkingLen)).toEqual({
      thinking: 'Teraz skrócę akapity i sprawdzę score.',
      message: '',
    });
  });

  it('clamps thinkingLen to stream bounds', () => {
    expect(splitRanksmileThinkingAndMessage('abc', 99)).toEqual({
      thinking: 'abc',
      message: '',
    });
    expect(splitRanksmileThinkingAndMessage('abc', -5)).toEqual({
      thinking: '',
      message: 'abc',
    });
  });
});

describe('shouldShowRanksmileAnswerStream', () => {
  it('never shows answer stream once tools have engaged', () => {
    expect(shouldShowRanksmileAnswerStream({
      loading: true,
      streamAnswer: 'Now let me read a few key blocks…',
      hasTools: true,
    })).toBe(false);
  });

  it('streams freely when no tools were used', () => {
    expect(shouldShowRanksmileAnswerStream({
      loading: true,
      streamAnswer: 'Cześć!',
      hasTools: false,
    })).toBe(true);
  });

  it('hides when not loading or answer empty', () => {
    expect(shouldShowRanksmileAnswerStream({
      loading: false,
      streamAnswer: 'Hi',
      hasTools: false,
    })).toBe(false);
    expect(shouldShowRanksmileAnswerStream({
      loading: true,
      streamAnswer: '  ',
      hasTools: false,
    })).toBe(false);
  });
});

describe('shouldShowRanksmileThinkingDisclosure', () => {
  it('hides Thinking when a final message is already present', () => {
    expect(shouldShowRanksmileThinkingDisclosure(
      'Sprawdzam score…',
      'Oto co widzę na starcie: …',
    )).toBe(false);
  });

  it('shows Thinking only when narration exists and message is empty', () => {
    expect(shouldShowRanksmileThinkingDisclosure('Sprawdzam score…', '')).toBe(true);
    expect(shouldShowRanksmileThinkingDisclosure('Sprawdzam score…', '   ')).toBe(true);
  });

  it('hides when thinking is empty', () => {
    expect(shouldShowRanksmileThinkingDisclosure('', 'Cześć!')).toBe(false);
    expect(shouldShowRanksmileThinkingDisclosure(undefined, undefined)).toBe(false);
  });
});
