import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function Button({ text }: { text: string }) {
  const toast = useToast();
  return <button onClick={() => toast(text)}>avisar</button>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('announces the message in a polite live region and hides it after a few seconds', () => {
    render(<ToastProvider><Button text="Cambios guardados." /></ToastProvider>);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.classList.contains('show')).toBe(false);
    act(() => screen.getByText('avisar').click());
    expect(region.textContent).toBe('Cambios guardados.');
    expect(region.classList.contains('show')).toBe(true);
    act(() => vi.advanceTimersByTime(3399));
    expect(region.classList.contains('show')).toBe(true);
    act(() => vi.advanceTimersByTime(2));
    expect(region.classList.contains('show')).toBe(false);
    expect(region.textContent).toBe('Cambios guardados.');
  });

  it('restarts the countdown when a new message arrives', () => {
    render(<ToastProvider><Button text="Uno" /></ToastProvider>);
    const region = screen.getByRole('status');
    act(() => screen.getByText('avisar').click());
    act(() => vi.advanceTimersByTime(3000));
    act(() => screen.getByText('avisar').click());
    act(() => vi.advanceTimersByTime(3000));
    expect(region.classList.contains('show')).toBe(true);
  });

  it('does nothing outside a provider', () => {
    render(<Button text="x" />);
    expect(() => act(() => screen.getByText('avisar').click())).not.toThrow();
  });
});
