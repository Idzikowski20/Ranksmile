// __tests__/ui/useSortState.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useSortState } from '../../lib/useSortState';

describe('useSortState', () => {
  it('startuje z domyślnym kluczem i kierunkiem desc', () => {
    const { result } = renderHook(() => useSortState('clicks'));
    expect(result.current.sortKey).toBe('clicks');
    expect(result.current.sortDir).toBe('desc');
  });
  it('ten sam klucz przełącza kierunek', () => {
    const { result } = renderHook(() => useSortState('clicks'));
    act(() => result.current.handleSort('clicks'));
    expect(result.current.sortDir).toBe('asc');
    act(() => result.current.handleSort('clicks'));
    expect(result.current.sortDir).toBe('desc');
  });
  it('nowy klucz ustawia desc', () => {
    const { result } = renderHook(() => useSortState<string>('clicks'));
    act(() => result.current.handleSort('clicks')); // -> asc
    act(() => result.current.handleSort('position'));
    expect(result.current.sortKey).toBe('position');
    expect(result.current.sortDir).toBe('desc');
  });
});
