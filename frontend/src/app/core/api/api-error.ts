import { HttpErrorResponse } from '@angular/common/http';

/** Keep backend validation/error messages when supplied; tolerate empty or non-JSON error bodies. */
export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Une erreur inattendue est survenue.';
  if (error.status === 0) return 'Connexion impossible au serveur. Vérifiez que l’application est démarrée.';
  const body: unknown = error.error;
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const field of ['error', 'detail', 'title']) {
      const message = record[field];
      if (typeof message === 'string' && message.trim()) return message;
    }
  }
  if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) return body;
  switch (error.status) {
    case 400: return 'Requête invalide. Vérifiez les informations saisies.';
    case 404: return 'La ressource demandée est introuvable.';
    case 409: return 'Opération impossible : conflit avec les règles métier.';
    default: return `Erreur HTTP ${error.status || 'inconnue'}.`;
  }
}
