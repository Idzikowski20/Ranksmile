import {
  stripDataImages, restoreDataImages, stripSids, makeWorkingDoc, reindexSids, buildOutline, sanitizeFragment,
} from '../../../lib/ai/workingDoc';

describe('stripDataImages / restoreDataImages', () => {
  it('round-trips base64 image sources through placeholders', () => {
    const html = '<p>hi</p><img src="data:image/png;base64,AAAA"><img src="https://x/y.png">';
    const { stripped, map } = stripDataImages(html);
    expect(stripped).not.toContain('data:image/png;base64,AAAA');
    expect(stripped).toContain('__SURFY_IMG_0__');
    expect(stripped).toContain('https://x/y.png'); // non-data src untouched
    expect(restoreDataImages(stripped, map)).toContain('data:image/png;base64,AAAA');
  });
});

describe('makeWorkingDoc', () => {
  it('annotates top-level blocks with sequential data-sid and builds an outline', () => {
    const { $, outline } = makeWorkingDoc('<h1>Title</h1><p>First para</p><p>Second</p>');
    expect($('[data-sid="0"]').prop('tagName')?.toLowerCase()).toBe('h1');
    expect($('[data-sid="1"]').text()).toBe('First para');
    expect($('[data-sid="2"]').length).toBe(1);
    expect(outline).toContain('[sid 0] <h1> Title');
    expect(outline).toContain('[sid 1] <p> First para');
  });
});

describe('reindexSids', () => {
  it('renumbers blocks after an out-of-band insert and returns the fresh outline', () => {
    const { $ } = makeWorkingDoc('<p>A</p><p>B</p>');     // sids 0,1
    $('[data-sid="0"]').before('<p>NEW</p>');             // inserted block has no sid yet
    const outline = reindexSids($);                        // renumber 0,1,2
    expect($('[data-sid="0"]').text()).toBe('NEW');
    expect($('[data-sid="2"]').text()).toBe('B');
    expect(outline).toContain('[sid 0] <p> NEW');
  });
});

describe('buildOutline', () => {
  it('reads existing sids without mutating them (pure)', () => {
    const { $ } = makeWorkingDoc('<p>A</p><p>B</p>');
    $('[data-sid="0"]').attr('data-sid', '7'); // deliberately non-contiguous
    const outline = buildOutline($);
    expect(outline).toContain('[sid 7] <p> A'); // reflects current sid, did not renumber
    expect($('[data-sid="7"]').length).toBe(1);
  });
});

describe('sanitizeFragment', () => {
  it('strips scripts, iframes, and on* handlers but keeps safe content', () => {
    const out = sanitizeFragment('<p onclick="x()">hi</p><script>evil()</script><iframe src="z"></iframe>');
    expect(out).toContain('hi');
    expect(out).not.toContain('script');
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('onclick');
  });
});

describe('stripSids', () => {
  it('removes all data-sid attributes from html', () => {
    const out = stripSids('<p data-sid="0">a</p><p data-sid="12">b</p>');
    expect(out).not.toContain('data-sid');
    expect(out).toBe('<p>a</p><p>b</p>');
  });
});
