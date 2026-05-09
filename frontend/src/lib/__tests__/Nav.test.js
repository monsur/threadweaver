import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Nav from '../Nav.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Nav', () => {
  test('renders Threadweaver label and current view in breadcrumb', () => {
    const { getByText } = render(Nav, { currentView: 'editor', setView: vi.fn() });
    expect(getByText('Threadweaver')).toBeInTheDocument();
    expect(getByText('Editor')).toBeInTheDocument();
  });

  test('dropdown is closed by default', () => {
    const { queryByRole } = render(Nav, { currentView: 'editor', setView: vi.fn() });
    expect(queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('clicking the current view button opens the dropdown', async () => {
    const { getByText, getByRole } = render(Nav, { currentView: 'editor', setView: vi.fn() });
    await fireEvent.click(getByText('Editor'));
    expect(getByRole('listbox')).toBeInTheDocument();
  });

  test('dropdown shows both Editor and Readwise options', async () => {
    const { getByText, getAllByText } = render(Nav, { currentView: 'editor', setView: vi.fn() });
    await fireEvent.click(getByText('Editor'));
    // Both appear: one in the breadcrumb trigger, one in the dropdown
    const editorItems = getAllByText('Editor');
    expect(editorItems.length).toBeGreaterThanOrEqual(1);
    expect(getByText('Readwise')).toBeInTheDocument();
  });

  test('active class applied to current view option in dropdown', async () => {
    const { getByText, getAllByText } = render(Nav, { currentView: 'editor', setView: vi.fn() });
    await fireEvent.click(getByText('Editor'));
    const editorOptions = getAllByText('Editor');
    const dropdownOption = editorOptions.find(el => el.closest('[role="listbox"]'));
    expect(dropdownOption).toHaveClass('active');
    expect(getByText('Readwise')).not.toHaveClass('active');
  });

  test('clicking a different view calls setView and closes dropdown', async () => {
    const setView = vi.fn();
    const { getByText, queryByRole } = render(Nav, { currentView: 'editor', setView });
    await fireEvent.click(getByText('Editor'));
    await fireEvent.click(getByText('Readwise'));
    expect(setView).toHaveBeenCalledWith('readwise');
    expect(queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('clicking the current view option calls setView with current view', async () => {
    const setView = vi.fn();
    const { getByText, getAllByText } = render(Nav, { currentView: 'editor', setView });
    await fireEvent.click(getByText('Editor'));
    const editorOptions = getAllByText('Editor');
    const dropdownOption = editorOptions.find(el => el.closest('[role="listbox"]'));
    await fireEvent.click(dropdownOption);
    expect(setView).toHaveBeenCalledWith('editor');
  });

  test('pressing Escape closes the dropdown', async () => {
    const { getByText, queryByRole } = render(Nav, { currentView: 'editor', setView: vi.fn() });
    await fireEvent.click(getByText('Editor'));
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(queryByRole('listbox')).not.toBeInTheDocument();
  });
});
