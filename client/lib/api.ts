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
  const headers: Record<string, string> = {};
  
  // Copy existing headers
  if (options?.headers) {
    const existingHeaders = options.headers as Record<string, string>;
    Object.keys(existingHeaders).forEach(key => {
      headers[key] = existingHeaders[key];
    });
  }
  
  // Set Content-Type for non-FormData requests
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Include session token for authenticated requests
  const sessionToken = localStorage.getItem('bingo.sessionToken');
  if (sessionToken) {
    headers['x-session-token'] = sessionToken;
  }

  return fetch(url, {
    ...options,
    headers,
  });
};
