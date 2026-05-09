import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Nav from '../Nav.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Nav', () => {
  test('renders Editor and Readwise links', () => {
    const { getByText } = render(Nav, { currentView: 'editor', setView: vi.fn() });
    expect(getByText('Editor')).toBeInTheDocument();
    expect(getByText('Readwise')).toBeInTheDocument();
  });

  test('applies active class to link matching currentView', () => {
    const { getByText } = render(Nav, { currentView: 'editor', setView: vi.fn() });
    expect(getByText('Editor')).toHaveClass('active');
    expect(getByText('Readwise')).not.toHaveClass('active');
  });

  test('applies active class to Readwise when currentView is readwise', () => {
    const { getByText } = render(Nav, { currentView: 'readwise', setView: vi.fn() });
    expect(getByText('Readwise')).toHaveClass('active');
    expect(getByText('Editor')).not.toHaveClass('active');
  });

  test('clicking Editor calls setView with editor', async () => {
    const setView = vi.fn();
    const { getByText } = render(Nav, { currentView: 'readwise', setView });
    await fireEvent.click(getByText('Editor'));
    expect(setView).toHaveBeenCalledWith('editor');
  });

  test('clicking Readwise calls setView with readwise', async () => {
    const setView = vi.fn();
    const { getByText } = render(Nav, { currentView: 'editor', setView });
    await fireEvent.click(getByText('Readwise'));
    expect(setView).toHaveBeenCalledWith('readwise');
  });
});
