import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = join(__dirname, '..', 'output', 'session.json');

export function loadSession() {
  let raw;
  try {
    raw = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));
  } catch {
    throw new Error('output/session.json not found. Run: node discover.js');
  }

  const cookies = raw.cookies ?? [];
  if (cookies.length === 0) throw new Error('Session file has no cookies. Run: node discover.js --reauth');

  const sessionCookie = cookies.find(c => c.name === 'sessionid');
  if (!sessionCookie) throw new Error('No sessionid cookie. Run: node discover.js --reauth');

  const csrfCookie = cookies.find(c => c.name === 'csrftoken');
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  return {
    cookieString,
    csrfToken: csrfCookie?.value ?? '',
  };
}

export function getAuthHeaders() {
  const { cookieString, csrfToken } = loadSession();
  return {
    'Cookie': cookieString,
    'X-CSRFToken': csrfToken,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.tijorifinance.com/',
    'Origin': 'https://www.tijorifinance.com',
  };
}
