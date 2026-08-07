import React from 'react';
import { render, screen } from '@testing-library/react';
import ScoreFactorList from '../../components/articles/ScoreFactorList';

describe('ScoreFactorList', () => {
  it('shows a readable label and the sentence that earned the point', () => {
    render(<ScoreFactorList factors={[{
      name: 'INTRODUCTION_EARLY_QUERY_ANSWER',
      found: true,
      score: 0.96,
      textSpan: 'Detektywi w Krakowie realizują obserwację osób.',
    }]} />);
    expect(screen.getByText('Answers the query early')).toBeInTheDocument();
    expect(screen.getByText('“Detektywi w Krakowie realizują obserwację osób.”')).toBeInTheDocument();
  });

  it('tells the writer what is missing instead of showing an empty quote', () => {
    render(<ScoreFactorList factors={[{
      name: 'INTRODUCTION_TARGET_AUDIENCE', found: false, score: 0,
    }]} />);
    expect(screen.getByText('Not found in the introduction')).toBeInTheDocument();
  });

  it('shows facts coverage as a percentage', () => {
    render(<ScoreFactorList factors={[{
      name: 'FACTS_COVERAGE', found: true, score: 0.82, value: 82,
    }]} />);
    expect(screen.getByText('82%')).toBeInTheDocument();
  });
});
