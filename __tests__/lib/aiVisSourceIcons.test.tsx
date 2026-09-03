/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { SourceInlineIcon, SourceBadge } from '@/components/aiVisibility/sourceIcons';

describe('llm provenance icon', () => {
   it('renders for llm and stays labelled', () => {
      const { container, getByLabelText } = render(<SourceInlineIcon source="llm" />);
      expect(getByLabelText('Generated for this topic')).toBeTruthy();
      expect(container.querySelector('svg')).toBeTruthy();
   });
   it('works in the stacked topic badge too', () => {
      const { container } = render(<SourceBadge source="llm" />);
      expect(container.querySelector('svg')).toBeTruthy();
   });
   it('still renders nothing for an unknown source', () => {
      const { container } = render(<SourceInlineIcon source="nope" />);
      expect(container.querySelector('svg')).toBeNull();
   });
});
