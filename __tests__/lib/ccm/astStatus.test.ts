import type { LexicalAst, SemanticAst } from '../../../lib/ccm/types/ast';
import type { CoverageStatus, ContentProfileId } from '../../../lib/ccm/types/status';

describe('ccm status + ast types', () => {
  it('accepts LexicalAst / SemanticAst assignability', () => {
    const ast: LexicalAst = {
      version: 1,
      blocks: [
        {
          blockId: 'b1',
          type: 'heading',
          headingLevel: 1,
          text: 'Title',
        },
      ],
    };
    const semantic: SemanticAst = {
      version: 1,
      claims: [
        {
          id: 'c1',
          blockId: 'b1',
          startOffset: 0,
          endOffset: 5,
          text: 'Title',
          kind: 'factish',
        },
      ],
      discourse: [{ blockId: 'b1', role: 'definition' }],
    };
    expect(ast.blocks).toHaveLength(1);
    expect(semantic.claims[0]?.kind).toBe('factish');
  });

  it('CoverageStatus and ContentProfileId are closed unions', () => {
    const status: CoverageStatus = 'missing';
    const profile: ContentProfileId = 'generic';
    expect(status).toBe('missing');
    expect(profile).toBe('generic');
  });
});
