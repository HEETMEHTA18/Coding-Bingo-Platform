// Client-side API configuration
export const getApiBaseUrl = (): string => {
  // Use the same origin as the frontend (Vite dev server integrates Express)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

export const apiFetch = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  // Don't set Content-Type for FormData - let the browser set it with boundary
  const headers = { ...options?.headers };
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    ...options,
    headers,
  });
};