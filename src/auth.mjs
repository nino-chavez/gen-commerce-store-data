import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { URL } from 'node:url';
import { createLogger } from './logger.mjs';

const log = createLogger('auth');

const SCOPES = [
  'read_products',
  'write_products',
  'read_customers',
  'write_customers',
  'read_orders',
  'write_orders',
  'read_content',
  'write_content',
  'read_price_rules',
  'write_price_rules',
  'read_discounts',
  'write_discounts',
].join(',');

const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

/**
 * Shopify OAuth flow: exchanges a Client ID + Secret for an Admin API access token.
 * Opens the authorize URL in the browser, catches the redirect on localhost, and
 * writes SHOPIFY_ACCESS_TOKEN to .env.
 */
export async function authenticate(storeUrl, clientId, clientSecret) {
  const store = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const authUrl =
    `https://${store}/admin/oauth/authorize?` +
    `client_id=${clientId}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  log.info('Open this URL in your browser to authorize the app:');
  log.dim(`  ${authUrl}`);
  log.info('Waiting for authorization...');

  try {
    const { exec } = await import('node:child_process');
    exec(`open "${authUrl}"`);
  } catch {
    // user can open manually
  }

  const code = await waitForAuthCode();

  log.info('Exchanging authorization code for access token...');
  const tokenUrl = `https://${store}/admin/oauth/access_token`;
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  log.success(`Access token obtained. Scopes: ${data.scope}`);

  saveTokenToEnv(data.access_token);
  return data.access_token;
}

function waitForAuthCode() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname !== '/callback') return;

      const code = url.searchParams.get('code');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a1a;color:#fff;">
            <div style="text-align:center;"><h1>Authorized!</h1><p>You can close this tab and return to the terminal.</p></div>
          </body></html>
        `);
        server.close();
        resolve(code);
      } else {
        const error = url.searchParams.get('error') || 'No code received';
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(`Authorization failed: ${error}`);
        server.close();
        reject(new Error(`Authorization failed: ${error}`));
      }
    });

    server.listen(REDIRECT_PORT);
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out after 2 minutes'));
    }, 120_000);
  });
}

function saveTokenToEnv(token) {
  const envPath = '.env';
  if (existsSync(envPath)) {
    let content = readFileSync(envPath, 'utf-8');
    if (content.includes('SHOPIFY_ACCESS_TOKEN=')) {
      content = content.replace(/SHOPIFY_ACCESS_TOKEN=.*/, `SHOPIFY_ACCESS_TOKEN=${token}`);
    } else {
      content += `\nSHOPIFY_ACCESS_TOKEN=${token}\n`;
    }
    writeFileSync(envPath, content);
  } else {
    writeFileSync(envPath, `SHOPIFY_ACCESS_TOKEN=${token}\n`);
  }
  log.success('Access token saved to .env');
}
