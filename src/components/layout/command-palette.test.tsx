import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { CommandPalette, useCommandPaletteShortcut } from './command-palette';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

setupMockApi();

function Harness() {
  const [open, setOpen] = useState(false);
  useCommandPaletteShortcut(() => setOpen((o) => !o));
  return <CommandPalette open={open} onOpenChange={setOpen} />;
}

describe('CommandPalette', () => {
  it('⌘K abre; flechas + Enter navegan a la sección elegida', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness />);
    await user.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByRole('combobox', { name: /Buscar secciones/ });
    await user.type(input, 'audit');
    expect(screen.getByRole('option', { name: /Auditoría/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/auditoria');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('busca clínicas en el backend por nombre o slug', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness />);
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'lara');
    const option = await screen.findByRole('option', { name: /Odontología Integral Lara/ });
    await user.click(option);
    expect(push).toHaveBeenCalledWith('/clinicas/c-lara');
  });

  it('acciones rápidas y sin resultados', async () => {
    const user = userEvent.setup();
    renderWithClient(<Harness />);
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByRole('combobox'), 'nueva cl');
    expect(screen.getByRole('option', { name: /Nueva clínica/ })).toBeInTheDocument();
    await user.clear(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'zzz');
    expect(await screen.findByText('Sin resultados.')).toBeInTheDocument();
  });
});
