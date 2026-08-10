/** @type {import('next').NextConfig} */
const nextConfig = {
  // @nhost/nhost-js v2's auth client is a singleton wrapping an XState
  // interpreter that gets started once. React 18 Strict Mode's intentional
  // double-invoke of effects (mount -> cleanup -> mount) calls the SDK's
  // onAuthStateChanged unsubscribe in a way that stops that interpreter for
  // good, so any later sign-in silently hangs ("stopped service" warning in
  // the console). Disabling Strict Mode avoids that double-invoke; this is a
  // dev-only safety net, not app behavior, so turning it off here is safe.
  reactStrictMode: false,
};

export default nextConfig;
