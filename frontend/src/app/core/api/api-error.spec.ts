import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error';

const httpError = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('apiErrorMessage', () => {
  it('handles non-HTTP failures', () => {
    expect(apiErrorMessage(new Error('unexpected'))).toContain('inattendue');
  });
  it('distinguishes network errors', () => {
    expect(apiErrorMessage(httpError(0, null))).toContain('Connexion impossible');
  });
  it.each(['error', 'detail', 'title'] as const)('preserves backend %s text', field => {
    expect(apiErrorMessage(httpError(409, { [field]: 'Quota atteint' }))).toBe('Quota atteint');
  });
  it('prioritizes error over detail and title', () => {
    expect(apiErrorMessage(httpError(400, { error: 'a', detail: 'b', title: 'c' }))).toBe('a');
  });
  it('returns raw plain-text server errors', () => {
    expect(apiErrorMessage(httpError(400, 'Champ invalide'))).toBe('Champ invalide');
  });
  it.each([400, 404, 409])('uses a fallback for HTTP %i with no readable body', status => {
    expect(apiErrorMessage(httpError(status, '<html>Error</html>'))).not.toContain('<html>');
  });
  it('includes status for other HTTP failures', () => {
    expect(apiErrorMessage(httpError(503, null))).toContain('503');
  });
});
