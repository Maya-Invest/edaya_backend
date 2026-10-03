/* eslint-disable node/no-process-env */
const GRAPHIQL_ENDPOINT = "/graphql";
const DEFAULT_WEBAPP_ORIGIN = "http://localhost:5173";

export interface GraphiQLOptions {
  endpointPath?: string;
  devApiKey?: string;
  webappOrigin?: string;
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
  return process.env.GRAPHQL_DEV_API_KEY;
}

export function renderGraphiQLPage(options: GraphiQLOptions = {}): string {
  const endpointPath = options.endpointPath ?? GRAPHIQL_ENDPOINT;
  const webappOrigin = options.webappOrigin ?? DEFAULT_WEBAPP_ORIGIN;
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

      const banner = document.getElementById('auth-banner');
      const login = document.createElement('a');
      login.href = ${JSON.stringify(webappOrigin)};
      login.target = '_blank';
      login.rel = 'noreferrer';
      login.textContent = 'Open the webapp to sign in';
      banner.textContent = 'Set Authorization: Bearer <access-token or service-account-key> in Headers. ';
      banner.appendChild(login);

      const fetcher = createGraphiQLFetcher({
        url: ${JSON.stringify(endpointPath)},
        fetch: (url, options) => fetch(url, { ...options, credentials: 'omit', headers: options?.headers }),
      });
      const plugins = [HISTORY_PLUGIN, explorerPlugin()];

      function App() {
        return React.createElement(GraphiQL, {
          fetcher,
          plugins,
          shouldPersistHeaders: true,
          initialHeaders: ${initialHeadersJson},
          defaultEditorToolsVisibility: true,
          defaultQuery: '# Set Authorization in Headers.\\n\\n# Paginated list (default API limit = 50 when offset/limit omitted on REST).\\nquery ListStudentsPage1 {\\n  students(filter: {\\n    limit: 50\\n    offset: 0\\n    orderBy: [{ field: "lastName", direction: asc }, { field: "firstName", direction: asc }]\\n  }) {\\n    id\\n    firstName\\n    lastName\\n  }\\n}\\n',
        });
      }

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
