import {
  splitSurfyThinkingAndMessage,
  shouldShowSurfyAnswerStream,
  shouldShowSurfyThinkingDisclosure,
} from '../../../lib/ai/text';

describe('splitSurfyThinkingAndMessage', () => {
  it('splits thinking vs answer at thinkingLen', () => {
    const streamed = 'Planuję edycję.\nMeta gotowa.';
    const thinkingLen = 'Planuję edycję.\n'.length;
    expect(splitSurfyThinkingAndMessage(streamed, thinkingLen)).toEqual({
      thinking: 'Planuję edycję.',
      message: 'Meta gotowa.',
    });
  });

  it('does not fall back to full text when answer slice is empty', () => {
    const streamed = 'Teraz skrócę akapity i sprawdzę score.';
    const thinkingLen = streamed.length;
    expect(splitSurfyThinkingAndMessage(streamed, thinkingLen)).toEqual({
      thinking: 'Teraz skrócę akapity i sprawdzę score.',
      message: '',
    });
  });

  it('clamps thinkingLen to stream bounds', () => {
    expect(splitSurfyThinkingAndMessage('abc', 99)).toEqual({
      thinking: 'abc',
      message: '',
    });
    expect(splitSurfyThinkingAndMessage('abc', -5)).toEqual({
      thinking: '',
      message: 'abc',
    });
  });
});

describe('shouldShowSurfyAnswerStream', () => {
  it('never shows answer stream once tools have engaged', () => {
    expect(shouldShowSurfyAnswerStream({
      loading: true,
      streamAnswer: 'Now let me read a few key blocks…',
      hasTools: true,
    })).toBe(false);
  });

  it('streams freely when no tools were used', () => {
    expect(shouldShowSurfyAnswerStream({
      loading: true,
      streamAnswer: 'Cześć!',
      hasTools: false,
    })).toBe(true);
  });

  it('hides when not loading or answer empty', () => {
    expect(shouldShowSurfyAnswerStream({
      loading: false,
      streamAnswer: 'Hi',
      hasTools: false,
    })).toBe(false);
    expect(shouldShowSurfyAnswerStream({
      loading: true,
      streamAnswer: '  ',
      hasTools: false,
    })).toBe(false);
  });
});

describe('shouldShowSurfyThinkingDisclosure', () => {
  it('hides Thinking when a final message is already present', () => {
    expect(shouldShowSurfyThinkingDisclosure(
      'Sprawdzam score…',
      'Oto co widzę na starcie: …',
    )).toBe(false);
  });

  it('shows Thinking only when narration exists and message is empty', () => {
    expect(shouldShowSurfyThinkingDisclosure('Sprawdzam score…', '')).toBe(true);
    expect(shouldShowSurfyThinkingDisclosure('Sprawdzam score…', '   ')).toBe(true);
  });

  it('hides when thinking is empty', () => {
    expect(shouldShowSurfyThinkingDisclosure('', 'Cześć!')).toBe(false);
    expect(shouldShowSurfyThinkingDisclosure(undefined, undefined)).toBe(false);
  });
});
