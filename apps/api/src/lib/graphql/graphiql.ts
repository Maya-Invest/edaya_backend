/* eslint-disable node/no-process-env */
const GRAPHIQL_ENDPOINT = "/graphql";
const DEFAULT_WEBAPP_ORIGIN = "http://localhost:5173";
const DEFAULT_DEV_EMAIL = "c.moreau@school.edu";

export interface GraphiQLOptions {
  endpointPath?: string;
  devApiKey?: string;
  webappOrigin?: string;
  defaultEmail?: string;
}

export function isGraphiQLEnabled(nodeEnv = process.env.NODE_ENV): boolean {
  const flag = process.env.GRAPHQL_GRAPHIQL;
  if (flag === "true") {
    return true;
  }
  if (flag === "false") {
    return false;
  }
  return nodeEnv !== "production";
}

export function resolveGraphiQLDevApiKey(): string | undefined {
  return process.env.GRAPHQL_DEV_API_KEY ?? process.env.SERVICE_ACCOUNT_API_KEY;
}

export function renderGraphiQLPage(options: GraphiQLOptions = {}): string {
  const endpointPath = options.endpointPath ?? GRAPHIQL_ENDPOINT;
  const webappOrigin = options.webappOrigin ?? DEFAULT_WEBAPP_ORIGIN;
  const defaultEmail = options.defaultEmail ?? DEFAULT_DEV_EMAIL;
  const initialHeaders = options.devApiKey
    ? { Authorization: `Bearer ${options.devApiKey}` }
    : {};
  const initialHeadersJson = JSON.stringify(JSON.stringify(initialHeaders));

  return `<!--
 *  GraphiQL playground for local entity API testing.
-->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Edaya GraphiQL</title>
    <style>
      body {
        margin: 0;
        font-family: system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        height: 100dvh;
      }

      #auth-banner {
        padding: 0.75rem;
        font-size: 0.875rem;
        border-bottom: 1px solid #d0d7de;
        flex-shrink: 0;
      }

      #auth-banner a,
      #auth-banner button {
        color: inherit;
      }

      #auth-banner form {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        margin-top: 0.5rem;
      }

      #auth-banner input {
        font: inherit;
        padding: 0.35rem 0.5rem;
        border: 1px solid #c9d1d9;
        border-radius: 0.375rem;
        min-width: 12rem;
      }

      #auth-banner button {
        font: inherit;
        padding: 0.35rem 0.75rem;
        border: 1px solid #c9d1d9;
        border-radius: 0.375rem;
        background: #fff;
        cursor: pointer;
      }

      #auth-status {
        margin: 0;
      }

      #auth-error {
        margin: 0.35rem 0 0;
        color: #9a1c1c;
      }

      #graphiql {
        flex: 1;
        min-height: 0;
      }

      .loading {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 4rem;
      }
    </style>
    <link rel="stylesheet" href="https://esm.sh/graphiql/dist/style.css" />
    <link
      rel="stylesheet"
      href="https://esm.sh/@graphiql/plugin-explorer/dist/style.css"
    />
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19.1.0",
          "react/": "https://esm.sh/react@19.1.0/",

          "react-dom": "https://esm.sh/react-dom@19.1.0",
          "react-dom/": "https://esm.sh/react-dom@19.1.0/",

          "graphiql": "https://esm.sh/graphiql?standalone&external=react,react-dom,@graphiql/react,graphql",
          "graphiql/": "https://esm.sh/graphiql/",
          "@graphiql/plugin-explorer": "https://esm.sh/@graphiql/plugin-explorer?standalone&external=react,@graphiql/react,graphql",
          "@graphiql/react": "https://esm.sh/@graphiql/react?standalone&external=react,react-dom,graphql,@graphiql/toolkit,@emotion/is-prop-valid",

          "@graphiql/toolkit": "https://esm.sh/@graphiql/toolkit?standalone&external=graphql",
          "graphql": "https://esm.sh/graphql@16.11.0",
          "@emotion/is-prop-valid": "data:text/javascript,"
        }
      }
    </script>
    <script type="module">
      import React from 'react';
      import ReactDOM from 'react-dom/client';
      import { GraphiQL, HISTORY_PLUGIN } from 'graphiql';
      import { createGraphiQLFetcher } from '@graphiql/toolkit';
      import { explorerPlugin } from '@graphiql/plugin-explorer';
      import 'graphiql/setup-workers/esm.sh';

      const webappOrigin = ${JSON.stringify(webappOrigin)};
      const defaultEmail = ${JSON.stringify(defaultEmail)};

      function renderSignedIn(banner, session, actor) {
        if (session && !actor) {
          banner.innerHTML =
            '<p id="auth-status">Better Auth session is active for '
            + (session.email ?? session.userId)
            + ', but no linked school actor was found.</p>'
            + '<p>Run <code>bun run seed:auth:link</code> from the repo root, or sign in with a seeded staff account such as '
            + '<code>c.moreau@school.edu</code>.</p>'
            + '<button type="button" id="graphiql-logout">Sign out</button>';
          banner.style.background = '#fde8e8';
          banner.style.color = '#7a1212';
          document.getElementById('graphiql-logout')?.addEventListener('click', signOut);
          return;
        }

        const label = session?.email ?? session?.name ?? actor?.actorId ?? 'signed in';
        banner.innerHTML =
          '<p id="auth-status">Actor ready: ' + actor.kind + ' (' + label + ')</p>'
          + '<button type="button" id="graphiql-logout">Sign out</button>';
        banner.style.background = '#e6f4ea';
        banner.style.color = '#1e4620';
        document.getElementById('graphiql-logout')?.addEventListener('click', signOut);
      }

      function renderSignedOut(banner, errorMessage) {
        banner.innerHTML =
          '<p id="auth-status">Sign in to run authenticated entity queries.</p>'
          + '<form id="graphiql-login-form">'
          + '<input id="graphiql-email" type="email" autocomplete="username" placeholder="Email" required />'
          + '<input id="graphiql-password" type="password" autocomplete="current-password" placeholder="Password" required />'
          + '<button type="submit">Sign in</button>'
          + '</form>'
          + '<p id="auth-error"></p>'
          + '<p>Or <a href="' + webappOrigin + '" target="_blank" rel="noreferrer">open the webapp</a>, '
          + 'or set <code>Authorization: Bearer &lt;service-account-key&gt;</code> in Headers.</p>';
        banner.style.background = '#fff8e1';
        banner.style.color = '#5c4a00';

        const emailInput = document.getElementById('graphiql-email');
        if (emailInput instanceof HTMLInputElement && defaultEmail) {
          emailInput.value = defaultEmail;
        }

        const error = document.getElementById('auth-error');
        if (error instanceof HTMLElement && errorMessage) {
          error.textContent = errorMessage;
        }

        document.getElementById('graphiql-login-form')?.addEventListener('submit', signIn);
      }

      async function updateAuthBanner(errorMessage) {
        const banner = document.getElementById('auth-banner');
        if (!banner) return;

        try {
          const response = await fetch('/graphiql/session', { credentials: 'include' });
          const data = await response.json();
          if (data?.session) {
            renderSignedIn(banner, data.session, data.actor);
            return;
          }
        } catch {
          // fall through to unsigned state
        }

        renderSignedOut(banner, errorMessage);
      }

      async function signIn(event) {
        event.preventDefault();
        const email = document.getElementById('graphiql-email')?.value;
        const password = document.getElementById('graphiql-password')?.value;
        const error = document.getElementById('auth-error');

        if (error) error.textContent = '';

        try {
          const response = await fetch('/graphiql/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            await updateAuthBanner(payload.message ?? 'Sign-in failed');
            return;
          }

          await updateAuthBanner();
        } catch (err) {
          await updateAuthBanner(err instanceof Error ? err.message : 'Sign-in failed');
        }
      }

      async function signOut() {
        await fetch('/graphiql/logout', { method: 'POST', credentials: 'include' });
        await updateAuthBanner();
      }

      const fetcher = createGraphiQLFetcher({
        url: ${JSON.stringify(endpointPath)},
        fetch: (url, options) => fetch(url, { ...options, credentials: 'include' }),
      });
      const plugins = [HISTORY_PLUGIN, explorerPlugin()];

      function App() {
        return React.createElement(GraphiQL, {
          fetcher,
          plugins,
          shouldPersistHeaders: true,
          initialHeaders: ${initialHeadersJson},
          defaultEditorToolsVisibility: true,
          defaultQuery: '# Sign in above, or set Authorization in Headers.\\n\\nquery ListStudents {\\n  students(filter: { limit: 10 }) {\\n    id\\n    firstName\\n    lastName\\n  }\\n}\\n',
        });
      }

      updateAuthBanner();
      const container = document.getElementById('graphiql');
      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(App));
    </script>
  </head>
  <body>
    <div id="auth-banner">Checking session…</div>
    <div id="graphiql">
      <div class="loading">Loading\u2026</div>
    </div>
  </body>
</html>`;
}
