import type { Message } from "ai";

/**
 * Creates an agent client that connects to the Personal Assistant
 * Optimized for both WebSocket and HTTP connections
 */
export function createAgentClient(id = "main-assistant") {
  const baseUrl = window.location.origin;
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  
  // Cache the WebSocket URL
  const wsUrl = `${wsProtocol}//${window.location.host}/agents/personal-assistant/${id}`;

  return {
    // Send messages via HTTP POST with proper error handling
    async send(messages: Message[]) {
      try {
        const response = await fetch(`${baseUrl}/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API Error (${response.status}): ${error}`);
        }

        return response;
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      }
    },

    // WebSocket connection with reconnection support
    connect(options?: { 
      onOpen?: () => void;
      onError?: (error: Event) => void;
      reconnectAttempts?: number;
    }) {
      let ws: WebSocket | null = null;
      let reconnectCount = 0;
      const maxReconnects = options?.reconnectAttempts ?? 3;

      const connect = () => {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          reconnectCount = 0;
          options?.onOpen?.();
        };
        
        ws.onerror = (event) => {
          options?.onError?.(event);
          
          // Auto-reconnect logic
          if (reconnectCount < maxReconnects) {
            reconnectCount++;
            setTimeout(connect, 1000 * reconnectCount); // Exponential backoff
          }
        };
      };

      connect();

      return {
        send: (data: string | object) => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(typeof data === 'string' ? data : JSON.stringify(data));
          } else {
            console.warn("WebSocket not connected");
          }
        },
        onMessage: (handler: (event: MessageEvent) => void) => {
          if (ws) ws.onmessage = handler;
        },
        onError: (handler: (event: Event) => void) => {
          if (ws) ws.onerror = handler;
        },
        onClose: (handler: (event: CloseEvent) => void) => {
          if (ws) ws.onclose = handler;
        },
        close: () => {
          if (ws) {
            ws.close();
            ws = null;
          }
        },
        getState: () => ws?.readyState,
      };
    },
  };
}

/**
 * Formats a timestamp for display with memoization
 */
const timeFormatter = new Intl.DateTimeFormat([], {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return timeFormatter.format(dateObj);
}

/**
 * Optimized debounce function with proper typing
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean }
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  const { leading = false, trailing = true } = options || {};

  return function debounced(...args: Parameters<T>) {
    lastArgs = args;
    
    const invokeFunc = () => {
      if (lastArgs && trailing) {
        func(...lastArgs);
      }
      timeout = null;
      lastArgs = null;
    };

    if (timeout) {
      clearTimeout(timeout);
    }

    if (leading && !timeout) {
      func(...args);
    }

    timeout = setTimeout(invokeFunc, wait);
  };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Retry utility for API calls
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: boolean;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { attempts = 3, delay = 1000, backoff = true, onRetry } = options;
  
  let lastError: Error;
  
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i < attempts - 1) {
        onRetry?.(lastError, i + 1);
        const waitTime = backoff ? delay * Math.pow(2, i) : delay;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Local storage helper with error handling
 */
export const storage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue ?? null;
    } catch (error) {
      console.error(`Error reading from localStorage:`, error);
      return defaultValue ?? null;
    }
  },
  
  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage:`, error);
      return false;
    }
  },
  
  remove(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from localStorage:`, error);
      return false;
    }
  },
  
  clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error(`Error clearing localStorage:`, error);
      return false;
    }
  }
};

/**
 * Generate unique IDs efficiently
 */
export function generateId(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${randomPart}` : `${timestamp}_${randomPart}`;
}
