import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import McpApiSettings from '../../components/settings/McpApiSettings';

describe('McpApiSettings', () => {
  it('shows the MCP tab by default with the connect URL', () => {
    render(<McpApiSettings />);
    expect(screen.getByText('Połącz z MCP Ranksmile')).toBeInTheDocument();
    expect(screen.getByText(/mcp\.ranksmile\.pl\/mcp/)).toBeInTheDocument();
  });

  it('switches to the API tab', () => {
    render(<McpApiSettings />);
    fireEvent.click(screen.getByRole('radio', { name: 'API' }));
    expect(screen.getByText('Dostęp do API nie jest dostępny w Twoim planie')).toBeInTheDocument();
    expect(screen.getByText('Dokumentacja')).toBeInTheDocument();
    expect(screen.queryByText('Połącz z MCP Ranksmile')).toBeNull();
  });
});
