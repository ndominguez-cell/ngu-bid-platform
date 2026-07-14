/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === 'edge') {
      // Vercel's Edge bundler resolves the "commonjs node:async_hooks" external
      // by including the real Node.js async_hooks source, which references
      // __dirname (undefined in Edge), causing MIDDLEWARE_INVOCATION_FAILED.
      //
      // Fix: replace the external with a "var (expr)" that returns an inline
      // object backed by Edge-global AsyncLocalStorage instead of the Node.js module.
      if (Array.isArray(config.externals)) {
        config.externals = config.externals.map((ext) => {
          if (ext && typeof ext === 'object' && !Array.isArray(ext) && typeof ext.then === 'undefined') {
            const patched = { ...ext };
            const edgeShim =
              'var ({"AsyncLocalStorage":globalThis.AsyncLocalStorage,' +
              '"AsyncResource":globalThis.AsyncResource,' +
              '"createHook":function(){return{enable:function(){},disable:function(){}}},' +
              '"executionAsyncId":function(){return 0},' +
              '"triggerAsyncId":function(){return 0}})';
            if ('node:async_hooks' in patched) patched['node:async_hooks'] = edgeShim;
            if ('async_hooks' in patched) patched['async_hooks'] = edgeShim;
            return patched;
          }
          return ext;
        });
      }
    }
    return config;
  },
};

export default nextConfig;
