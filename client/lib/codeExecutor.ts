// Safe JavaScript code executor for Code Canvas game
export interface ExecutionResult {
  success: boolean;
  coordinates?: [number, number][];
  error?: string;
  executionTime?: number;
}

/**
 * Execute C/C++ code using backend compiler service
 */
async function executeNativeCode(code: string, timeout: number): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // Detect language
    const language = code.includes('using namespace') || code.includes('std::') ? 'cpp' : 'c';

    console.log(`Compiling ${language.toUpperCase()} code using Docker (Timeout: ${timeout}ms)...`);

    const response = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, source: code }),
      signal: AbortSignal.timeout(timeout + 5000), // Give 5s extra for network
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Compilation service unavailable',
        executionTime: Date.now() - startTime,
      };
    }

    const result = await response.json();

    if (!result.success) {
      // Compilation or runtime error
      const errorMsg = result.compileOutput || result.error || result.stderr || 'Unknown error';
      return {
        success: false,
        error: errorMsg,
        executionTime: Date.now() - startTime,
      };
    }

    // Trim output
    let stdout = (result.stdout || '').trim();

    if (!stdout) {
      return {
        success: false,
        error: 'Program produced no output. Make sure to printf() the coordinate array as JSON.',
        executionTime: Date.now() - startTime,
      };
    }

    // Try to find a JSON array in the output (handles debug prints)
    // Matches the first [...] block that looks like it could be the coordinates
    const jsonMatch = stdout.match(/\[\s*\[.*?\]\s*\]/s);
    if (jsonMatch) {
      stdout = jsonMatch[0];
    } else {
      // Fallback for single array like [] or simple arrays, but our format is [[x,y]...]
      // If we didn't find a nested array, maybe it's just a single array or malformed.
      // We'll try to parse the whole string if specific match fails.
      const simpleMatch = stdout.match(/\[.*\]/s);
      if (simpleMatch) {
        stdout = simpleMatch[0];
      }
    }

    // Try to parse JSON coordinates
    try {
      const coordinates = JSON.parse(stdout);

      if (!Array.isArray(coordinates)) {
        return {
          success: false,
          error: 'Output is not a JSON array. Program should printf() something like: [[0,0],[1,1]]',
          executionTime: Date.now() - startTime,
        };
      }

      // Validate coordinates
      for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];
        if (!Array.isArray(coord) || coord.length !== 2) {
          return {
            success: false,
            error: `Invalid coordinate at index ${i}. Expected [x, y]`,
            executionTime: Date.now() - startTime,
          };
        }

        const [x, y] = coord;
        if (typeof x !== 'number' || typeof y !== 'number') {
          return {
            success: false,
            error: `Coordinates must be numbers at index ${i}`,
            executionTime: Date.now() - startTime,
          };
        }

        if (!Number.isInteger(x) || !Number.isInteger(y)) {
          return {
            success: false,
            error: `Coordinates must be integers at index ${i}`,
            executionTime: Date.now() - startTime,
          };
        }

        if (x < 0 || x > 9 || y < 0 || y > 9) {
          return {
            success: false,
            error: `Coordinate out of range (0-9) at index ${i}: [${x}, ${y}]`,
            executionTime: Date.now() - startTime,
          };
        }
      }

      return {
        success: true,
        coordinates: coordinates as [number, number][],
        executionTime: Date.now() - startTime,
      };

    } catch (parseErr) {
      return {
        success: false,
        error: `Failed to parse output as JSON. Got: ${stdout.substring(0, 100)}`,
        executionTime: Date.now() - startTime,
      };
    }

  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        success: false,
        error: 'Compilation/execution timeout',
        executionTime: Date.now() - startTime,
      };
    }

    return {
      success: false,
      error: `Network error: ${err.message || 'Failed to reach compiler service'}`,
      executionTime: Date.now() - startTime,
    };
  }
}

export function executeCode(code: string, timeout: number = 2000): ExecutionResult | Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    if (!code || code.trim().length === 0) {
      return { success: false, error: 'Code cannot be empty' };
    }

    // Check if code is C/C++ - now we support compilation!
    if (code.includes('#include') || code.includes('int main') || code.includes('using namespace')) {
      // Delegate to backend compiler service
      // Native compilation takes longer (Docker startup + compilation + execution)
      // We need to give it enough time, overriding the default short timeout for JS
      const nativeTimeout = Math.max(timeout, 60000); // Minimum 60s for native code
      return executeNativeCode(code, nativeTimeout);
    }

    // Security check for dangerous patterns (case-sensitive to avoid false positives)
    const forbidden = [
      { pattern: /\bimport\s+/i, message: 'import statements' },
      { pattern: /\brequire\s*\(/i, message: 'require()' },
      { pattern: /\beval\s*\(/i, message: 'eval()' },
      { pattern: /new\s+Function\s*\(/i, message: 'Function constructor' },
      { pattern: /\bsetTimeout\s*\(/i, message: 'setTimeout()' },
      { pattern: /\bsetInterval\s*\(/i, message: 'setInterval()' },
      { pattern: /\bfetch\s*\(/i, message: 'fetch()' },
      { pattern: /\bXMLHttpRequest\b/i, message: 'XMLHttpRequest' },
      { pattern: /\bWebSocket\b/i, message: 'WebSocket' },
      { pattern: /\blocalStorage\./i, message: 'localStorage' },
      { pattern: /\bsessionStorage\./i, message: 'sessionStorage' },
      { pattern: /\bdocument\./i, message: 'document object' },
      { pattern: /\bwindow\./i, message: 'window object' },
      { pattern: /\b__proto__\b/i, message: '__proto__' },
      { pattern: /\.constructor\s*\(/i, message: 'constructor access' }
    ];

    for (const { pattern, message } of forbidden) {
      if (pattern.test(code)) {
        return { success: false, error: `Security: ${message} is not allowed` };
      }
    }

    const wrappedCode = `
      (function() {
        'use strict';
        ${code}
        
        if (typeof generatePattern !== 'function') {
          throw new Error('You must define a function named "generatePattern"');
        }
        
        const result = generatePattern();
        
        if (!Array.isArray(result)) {
          throw new Error('generatePattern() must return an array');
        }
        
        for (let i = 0; i < result.length; i++) {
          const coord = result[i];
          if (!Array.isArray(coord) || coord.length !== 2) {
            throw new Error('Invalid coordinate at index ' + i + '. Expected [x, y]');
          }
          
          const [x, y] = coord;
          if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('Coordinates must be numbers');
          }
          
          if (!Number.isInteger(x) || !Number.isInteger(y)) {
            throw new Error('Coordinates must be integers');
          }
          
          if (x < 0 || x > 9 || y < 0 || y > 9) {
            throw new Error('Coordinates must be within 0-9 range. Got: [' + x + ', ' + y + ']');
          }
        }
        
        return result;
      })()
    `;

    // Execute the code with proper error handling
    let timedOut = false;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      timeoutId = setTimeout(() => {
        timedOut = true;
      }, timeout);

      // Use Function constructor for safe evaluation
      // The wrappedCode is an IIFE - we need to execute it and return its value
      const executor = new Function('return (' + wrappedCode + ')');

      // Execute user code and capture returned value
      const coordinatesRaw = executor();

      // Safe debug logging (avoid throwing from JSON.stringify on circular)
      try {
        console.log('=== EXECUTOR DEBUG ===');
        console.log('Coordinates returned:', coordinatesRaw);
        console.log('Coordinates type:', typeof coordinatesRaw);
        console.log('Is array:', Array.isArray(coordinatesRaw));
        console.log('Coordinates length:', Array.isArray(coordinatesRaw) ? coordinatesRaw.length : 'N/A');
        console.log('=====================');
      } catch (logErr) {
        console.warn('Executor debug log failed:', logErr);
      }

      if (timeoutId) clearTimeout(timeoutId);

      if (timedOut) {
        return {
          success: false,
          error: `Execution timeout (${timeout}ms). Your code took too long to execute.`
        };
      }

      // Basic sanity check - wrapped code already validates details
      if (!Array.isArray(coordinatesRaw)) {
        return {
          success: false,
          error: 'generatePattern() did not return an array. Make sure your function returns an array of [x, y] coordinates.'
        };
      }

      const result = {
        success: true,
        coordinates: coordinatesRaw as [number, number][],
        executionTime: Date.now() - startTime
      };

      try {
        console.log('=== RETURNING RESULT ===');
        console.log('Result object:', result);
        console.log('Result.coordinates length:', result.coordinates?.length);
        console.log('=======================');
      } catch (logErr) {
        console.warn('Executor return log failed:', logErr);
      }

      return result;
    } catch (execError: any) {
      if (timeoutId) clearTimeout(timeoutId);

      // Log execution errors for debugging
      console.error('Execution error in Function constructor:', execError);

      throw execError; // Re-throw to be caught by outer catch block
    }
  } catch (error: any) {
    // Provide detailed error information
    let errorMessage = 'Code execution failed';

    console.log('=== ERROR CAUGHT IN EXECUTOR ===');
    console.log('Error type:', typeof error);
    console.log('Error instanceof Error:', error instanceof Error);
    console.log('Error object:', error);
    console.log('Error.message:', error?.message);
    console.log('Error.toString():', error?.toString?.());
    console.log('================================');

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      if (error.message) {
        errorMessage = error.message;
      } else if (error.toString && typeof error.toString === 'function') {
        const stringified = error.toString();
        errorMessage = stringified !== '[object Object]' ? stringified : 'Unknown error object';
      }
    }

    // Add helpful context for common errors
    if (errorMessage.includes('generatePattern is not defined')) {
      errorMessage = 'Function "generatePattern" is not defined. Make sure to define it in your code.';
    } else if (errorMessage.includes('Unexpected token')) {
      errorMessage = 'Syntax error: ' + errorMessage;
    } else if (errorMessage.includes('is not a function')) {
      errorMessage = 'Error: ' + errorMessage + '. Check that generatePattern returns an array.';
    }

    // Ensure we always have a meaningful error message
    if (!errorMessage || errorMessage === 'Unknown execution error' || errorMessage === 'Code execution failed') {
      errorMessage = 'Unexpected error during code execution. Check your syntax and logic.';
    }

    return {
      success: false,
      error: errorMessage,
      executionTime: Date.now() - startTime
    };
  }
}

export function comparePatterns(
  userCoords: [number, number][],
  targetCoords: [number, number][]
): boolean {
  if (userCoords.length !== targetCoords.length) return false;

  const userSet = new Set(userCoords.map(([x, y]) => `${x},${y}`));
  const targetSet = new Set(targetCoords.map(([x, y]) => `${x},${y}`));

  for (const coord of targetSet) {
    if (!userSet.has(coord)) return false;
  }

  for (const coord of userSet) {
    if (!targetSet.has(coord)) return false;
  }

  return true;
}

export function calculateMatchPercentage(
  userCoords: [number, number][],
  targetCoords: [number, number][]
): number {
  if (targetCoords.length === 0) return 0;

  const targetSet = new Set(targetCoords.map(([x, y]) => `${x},${y}`));
  const userSet = new Set(userCoords.map(([x, y]) => `${x},${y}`));

  let correctCount = 0;
  for (const coord of userSet) {
    if (targetSet.has(coord)) correctCount++;
  }

  const matchPercentage = (correctCount / targetCoords.length) * 100;
  const extraCells = userCoords.length - targetCoords.length;
  const penalty = extraCells > 0 ? Math.min(extraCells * 2, 20) : 0;

  return Math.max(0, Math.min(100, matchPercentage - penalty));
}

export const DEFAULT_CODE_TEMPLATE = `function generatePattern() {
  // Write your code here to return an array of [x, y] coordinates
  // Example: return [[0, 0], [1, 1], [2, 2]];
  
  const coordinates = [];
  
  // Your logic here
  
  return coordinates;
}`;
