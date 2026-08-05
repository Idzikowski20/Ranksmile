/**
 * WIE Principles — durable rules. Patterns may change; principles rarely do.
 */
export type WritingPrinciple = {
  id: string;
  statement: string;
  /** Always wins over conflicting patterns */
  immutableWeight: number;
};

export const WRITING_PRINCIPLES: WritingPrinciple[] = [
  {
    id: 'answer_user_problem_first',
    statement: 'Najpierw odpowiedz na główny problem użytkownika.',
    immutableWeight: 1,
  },
  {
    id: 'concrete_over_abstract',
    statement: 'Preferuj konkretne przykłady i scenariusze zamiast samych definicji.',
    immutableWeight: 1,
  },
  {
    id: 'no_fake_credentials',
    statement: 'Nie wymyślaj tytułów, certyfikatów ani case studies.',
    immutableWeight: 1,
  },
  {
    id: 'depth_over_checklist',
    statement: 'Głębia na krytycznych punktach ważniejsza niż listy tematów pod score.',
    immutableWeight: 1,
  },
];

export function getPrinciple(id: string): WritingPrinciple | undefined {
  return WRITING_PRINCIPLES.find((p) => p.id === id);
}
