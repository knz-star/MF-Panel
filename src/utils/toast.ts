export type ToastKind = 'success' | 'warning' | 'error';
export function notify(message: string, kind: ToastKind = 'success') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mf-mpanel-toast', { detail: { message, kind } }));
}
