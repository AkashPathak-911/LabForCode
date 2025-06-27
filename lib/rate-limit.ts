import { NextRequest, NextResponse } from "next/server";

// Simple in-memory store for rate limiting
// In production, you'd want to use Redis for this
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: "Too many requests, please try again later.",
};

export function createRateLimit(config: Partial<RateLimitConfig> = {}) {
  const options = { ...DEFAULT_CONFIG, ...config };

  return (req: NextRequest): { success: boolean; response?: NextResponse } => {
    const now = Date.now();

    // Generate key for rate limiting (IP address by default)
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : getClientIP(req);

    // Clean up old entries
    cleanupExpiredEntries(now);

    // Get or create entry for this key
    const entry = store[key] || { count: 0, resetTime: now + options.windowMs };

    // Reset if window has expired
    if (now >= entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + options.windowMs;
    }

    // Check if limit exceeded
    if (entry.count >= options.maxRequests) {
      const remainingTime = Math.ceil((entry.resetTime - now) / 1000);

      return {
        success: false,
        response: NextResponse.json(
          {
            error: options.message,
            retryAfter: remainingTime,
            limit: options.maxRequests,
            window: options.windowMs / 1000,
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": options.maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": entry.resetTime.toString(),
              "Retry-After": remainingTime.toString(),
            },
          }
        ),
      };
    }

    // Increment counter
    entry.count++;
    store[key] = entry;

    // Add rate limit headers to successful responses
    const remaining = options.maxRequests - entry.count;

    return {
      success: true,
      response: undefined, // Will be handled by the actual endpoint
    };
  };
}

// Specific rate limit configurations for different endpoints
export const submissionRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10, // 10 code executions per 5 minutes
  message: "Too many code executions. Please wait before submitting more code.",
});

export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 API calls per 15 minutes
  message: "Too many API requests. Please slow down.",
});

export const healthCheckRateLimit = createRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 30, // 30 health checks per minute
  message: "Too many health check requests.",
});

// Helper function to get client IP
function getClientIP(req: NextRequest): string {
  // Check for forwarded IP first (for proxies/load balancers)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // Check for real IP
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address
  return (
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Cleanup expired entries to prevent memory leaks
function cleanupExpiredEntries(now: number) {
  const keysToDelete: string[] = [];

  for (const [key, entry] of Object.entries(store)) {
    if (now >= entry.resetTime && entry.count === 0) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => delete store[key]);
}

// Middleware to apply rate limiting to API routes
export function withRateLimit(
  rateLimitFn: ReturnType<typeof createRateLimit>,
  handler: (
    req: NextRequest,
    context?: any
  ) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest, context?: any) => {
    const result = rateLimitFn(req);

    if (!result.success && result.response) {
      return result.response;
    }

    // Continue to actual handler
    const response = await handler(req, context);

    // Add rate limit headers to successful responses
    const clientIP = getClientIP(req);
    const entry = store[clientIP];

    if (entry && response instanceof NextResponse) {
      response.headers.set("X-RateLimit-Limit", "100"); // This should come from config
      response.headers.set(
        "X-RateLimit-Remaining",
        (100 - entry.count).toString()
      );
      response.headers.set("X-RateLimit-Reset", entry.resetTime.toString());
    }

    return response;
  };
}

// Get current rate limit status for a client
export function getRateLimitStatus(req: NextRequest) {
  const clientIP = getClientIP(req);
  const entry = store[clientIP];

  if (!entry) {
    return {
      ip: clientIP,
      count: 0,
      limit: DEFAULT_CONFIG.maxRequests,
      remaining: DEFAULT_CONFIG.maxRequests,
      resetTime: Date.now() + DEFAULT_CONFIG.windowMs,
    };
  }

  return {
    ip: clientIP,
    count: entry.count,
    limit: DEFAULT_CONFIG.maxRequests,
    remaining: Math.max(0, DEFAULT_CONFIG.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}
