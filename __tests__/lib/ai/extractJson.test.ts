import { extractJsonObject, isRanksmileReplyShape, stripCodeFence } from '../../../lib/ai/extractJson';

describe('extractJsonObject', () => {
  it('parses a ```json-fenced reply blob (the bug: bare JSON.parse threw on the fence)', () => {
    const raw = '```json\n{\n"action":"optimize_selection",\n"message":"Poprawiłem formatowanie.",\n"content":"<h3>T</h3><p>x</p>"\n}\n```';
    const obj = extractJsonObject(raw);
    expect(obj).not.toBeNull();
    expect(obj!.message).toBe('Poprawiłem formatowanie.');
    expect(obj!.content).toBe('<h3>T</h3><p>x</p>');
    expect(isRanksmileReplyShape(obj)).toBe(true);
  });

  it('parses bare JSON and preserves null content', () => {
    const obj = extractJsonObject('{"action":"analysis_only","message":"Dodaj <title>.","content":null}');
    expect(obj!.message).toBe('Dodaj <title>.');
    expect(obj!.content).toBeNull();
  });

  it('does NOT misfire on prose containing stray braces', () => {
    const obj = extractJsonObject('Dodałem słowa do sekcji {ważne} — gotowe.');
    expect(isRanksmileReplyShape(obj)).toBe(false);
  });

  it('does NOT treat a non-reply JSON object as a Ranksmile reply', () => {
    const obj = extractJsonObject('Use {"key":"val"} as the format.');
    expect(isRanksmileReplyShape(obj)).toBe(false);
  });

  it('stripCodeFence removes a leading/trailing fence but leaves plain text intact', () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFence('just text')).toBe('just text');
  });
});
