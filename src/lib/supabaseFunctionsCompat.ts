import { invokeEdgeFunction } from '../services/edgeFunctionClient';
const actionMap: Record<string,string> = {
  createEvidencePairing: 'createPairing', cancelEvidencePairing: 'cancelPairing', disconnectEvidenceApp: 'disconnect',
  getEvidenceDashboardSummary: 'getSummary', getEvidenceLinksPage: 'getLinksPage', recordEvidenceLinksDownload: 'recordDownload',
  listEvidenceConnectionsForAdmin: 'listAdmin', redeemEvidencePairing: 'redeemPairing',
};
export function getFunctions(_app?: unknown, _region?: string) { return { provider: 'supabase-edge-functions' }; }
export function httpsCallable<T = unknown, R = unknown>(_functions: unknown, functionName: string) {
  return async (payload?: T): Promise<{ data: R }> => {
    try {
      const data = await invokeEdgeFunction<R>('mfp-evidence-linking', { action: actionMap[functionName] ?? functionName, ...(payload as any ?? {}) });
      return { data };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The Evidence service is unavailable. Please try again.';
      const code = /session/i.test(detail) ? 'unauthenticated' : /permission/i.test(detail) ? 'permission-denied' : /pairing code/i.test(detail) ? 'invalid-pairing-code' : 'functions/internal';
      throw Object.assign(new Error(detail), { code });
    }
  };
}
