// frontend/src/setupProxy.js - Last Resort: Target includes /api

const { createProxyMiddleware } = require('http-proxy-middleware');

console.log("--- setupProxy.js: File loaded by Node.js (Target includes /api approach) ---");

module.exports = function(app) {
  console.log("--- setupProxy.js: Module export function executed ---");
  app.use(
    // Still match requests that the browser sends starting with /api
    '/api',
    createProxyMiddleware({
      // --- CRITICAL CHANGE: Target URL now INCLUDES /api ---
      target: 'http://127.0.0.1:5001/api', // Backend path prefix included in target
      // --- END CRITICAL CHANGE ---
      changeOrigin: true, // Usually needed
      // --- CRITICAL CHANGE: pathRewrite now STRIPS the /api prefix ---
      // Because the target already has /api, we need to remove the one
      // from the incoming request path (/api/register -> /register)
      // so that it gets appended correctly to the target.
      // Result: sends '/register' to 'http://127.0.0.1:5001/api' -> http://127.0.0.1:5001/api/register
      pathRewrite: {
         '^/api': '', // Remove the leading /api from the request path
      },
      // --- END CRITICAL CHANGE ---
      logLevel: 'debug', // Keep detailed proxy logging
      onProxyReq: (proxyReq, req, res) => {
        // Log the ACTUAL path being sent TO THE BACKEND after rewrite
        console.log(`[Proxy Req] ${req.method} ${req.originalUrl} -> TO ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
      },
       onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy Res] Status: ${proxyRes.statusCode} From -> ${req.originalUrl}`);
      },
       onError: (err, req, res) => {
         console.error('[Proxy Error]', err);
         const target = 'http://127.0.0.1:5001/api'; // Update target in error msg
          if (res.writeHead && !res.headersSent) {
             res.writeHead(500, { 'Content-Type': 'text/plain' });
          } else if (!res.headersSent) {
              console.error("Cannot write head for proxy error response");
          }
          res.end(`Proxy Error connecting to ${target} (rewritten from ${req.originalUrl}): ${err.message}`);
       }
    })
  );
  console.log("--- setupProxy.js: Proxy middleware for /api registered (Target includes /api) ---");
};