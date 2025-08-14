const { RateLimiterMemory } = require('rate-limiter-flexible');

// Rate limiters for different endpoints
const authLimiter = new RateLimiterMemory({
  keyPrefix: 'auth_fail',
  points: 5, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60 * 15, // Block for 15 minutes
});

const generalLimiter = new RateLimiterMemory({
  keyPrefix: 'general_api',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 1 minute
});

const aiLimiter = new RateLimiterMemory({
  keyPrefix: 'ai_api',
  points: 20, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60 * 5, // Block for 5 minutes
});

const uploadLimiter = new RateLimiterMemory({
  keyPrefix: 'upload_api',
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60 * 2, // Block for 2 minutes
});

// Middleware factory for rate limiting
function createRateLimitMiddleware(limiter, identifier = 'general') {
  return async (req, res, next) => {
    try {
      // Use IP address or user ID if authenticated
      const key = req.user?.id || req.ip;
      
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      const totalHits = rejRes.totalHits || 0;
      const remainingPoints = rejRes.remainingPoints || 0;
      const msBeforeNext = rejRes.msBeforeNext || 0;
      
      console.log(`Rate limit exceeded for ${identifier}: ${key}, hits: ${totalHits}`);
      
      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
      });
      
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          retryAfter: Math.round(msBeforeNext / 1000)
        },
        timestamp: new Date().toISOString()
      });
    }
  };
}

// Setup rate limiting for the app
function setupRateLimiting(app) {
  // Apply general rate limiting to all API routes
  app.use('/api', createRateLimitMiddleware(generalLimiter, 'general'));
  
  // Apply stricter rate limiting to authentication routes
  app.use('/api/v1/auth', createRateLimitMiddleware(authLimiter, 'auth'));
  
  // Apply AI-specific rate limiting
  app.use('/api/v1/ai', createRateLimitMiddleware(aiLimiter, 'ai'));
  
  // Apply upload-specific rate limiting (if we add file upload endpoints)
  app.use('/api/v1/upload', createRateLimitMiddleware(uploadLimiter, 'upload'));
}

module.exports = {
  setupRateLimiting,
  createRateLimitMiddleware,
  authLimiter,
  generalLimiter,
  aiLimiter,
  uploadLimiter
};