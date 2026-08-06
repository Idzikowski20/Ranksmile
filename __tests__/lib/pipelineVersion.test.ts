import { PIPELINE_VERSION, pipelineVersionTag } from '../../lib/pipelineVersion';

describe('pipelineVersionTag', () => {
  it('records the planner version', () => {
    expect(pipelineVersionTag({ manualOutline: false })).toBe(PIPELINE_VERSION);
  });

  it('marks articles whose outline the user edited', () => {
    expect(pipelineVersionTag({ manualOutline: true })).toBe(`${PIPELINE_VERSION}+manual-outline`);
  });
});
