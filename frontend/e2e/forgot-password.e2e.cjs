/*
 * Browser end-to-end test for Forgot / Reset password (Playwright; no framework added to the
 * project: playwright-core is resolved from your machine, e.g. `npm i -g playwright-core` and
 * NODE_PATH, or PLAYWRIGHT_CORE=/path/to/playwright-core).
 *
 * It exercises the real path: UI -> API -> SMTP -> emailed link -> reset page -> login. Mail is
 * received by a tiny SMTP sink started by this script, so nothing leaves the machine.
 *
 * Start the backend and Vite first, with the backend pointed at the sink:
 *   TMS_SMTP_HOST=127.0.0.1 TMS_SMTP_PORT=1025 TMS_SMTP_SECURITY=none \
 *   TMS_MAIL_FROM=noreply@example.org TMS_APP_BASE_URL=http://localhost:5173 \
 *   TMS_SCHEDULER=off uvicorn app.main:app --port 8080
 *
 * Only temporary users `zztest.e2e.*@example.org` are created. They are NOT removed by this
 * script; remove them with the project's ZZTEST cleanup (or set TMS_E2E_CLEANUP_CMD).
 * TMS_E2E_EXPIRE_CMD is an optional shell command run as `<cmd> <email>` that expires that
 * user's outstanding token; without it the "expired link" check is skipped (reported).
 *
 * The backend rate limiter is in-memory: restart the backend between runs of this script.
 */
const net = require('net');
const { execSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const BASE = process.env.TMS_BASE_URL || 'http://localhost:5173';
const SINK_PORT = Number(process.env.SMTP_SINK_PORT || 1025);
const OLD = 'OldPassw0rd!';
const NEW = 'BrandNewPassw0rd!';
const RUN = Date.now().toString(36);
const mails = [];
const results = [];

// ------------------------------------------------------------------ SMTP sink
function decodeQuotedPrintable(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
const sink = net.createServer((sock) => {
  let buf = ''; let data = false; let lines = [];
  sock.write('220 sink ESMTP\r\n');
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) {
        if (line === '.') { data = false; mails.push(parse(lines.join('\r\n'))); lines = []; sock.write('250 queued\r\n'); }
        else lines.push(line.startsWith('..') ? line.slice(1) : line);
        continue;
      }
      const c = line.toUpperCase();
      if (c.startsWith('EHLO') || c.startsWith('HELO')) sock.write('250 sink\r\n');
      else if (c.startsWith('MAIL') || c.startsWith('RCPT') || c.startsWith('RSET')) sock.write('250 OK\r\n');
      else if (c.startsWith('DATA')) { data = true; sock.write('354 go\r\n'); }
      else if (c.startsWith('QUIT')) { sock.write('221 bye\r\n'); sock.end(); }
      else sock.write('250 OK\r\n');
    }
  });
  sock.on('error', () => {});
});
function parse(raw) {
  const [head, ...rest] = raw.split('\r\n\r\n');
  const body = decodeQuotedPrintable(rest.join('\r\n\r\n'));
  const to = (/^To:\s*(.+)$/im.exec(head) || [])[1] || '';
  const m = /reset-password#token=([A-Za-z0-9_-]+)/.exec(body);
  return { to: to.trim().toLowerCase(), head, body, token: m ? m[1] : null, at: Date.now() };
}
const mailsFor = (email) => mails.filter((m) => m.to === email.toLowerCase());
async function waitMail(email, count = 1, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (mailsFor(email).length >= count) return mailsFor(email)[count - 1];
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no mail #${count} for ${email} within ${ms} ms`);
}

// ------------------------------------------------------------------ helpers
async function t(name, fn) {
  try { const note = await fn(); results.push({ name, ok: true }); console.log(`PASS ${name}${note ? ' — ' + note : ''}`); }
  catch (e) { results.push({ name, ok: false }); console.log(`FAIL ${name} — ${String(e.message).split('\n')[0].slice(0, 220)}`); }
}
function skip(name, why) { console.log(`SKIP ${name} — ${why}`); }
const user = (tag) => `zztest.e2e.${tag}.${RUN}@example.org`;
async function register(email, password = OLD) {
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName: `ZZTEST E2E ${email.split('.')[2]}` }),
  });
  if (r.status !== 201) throw new Error(`register ${email}: ${r.status}`);
}
async function requestLink(page, email) {
  await page.goto(`${BASE}/forgot-password`);
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
}
async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

(async () => {
  await new Promise((r) => sink.listen(SINK_PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = async (vp) => { const c = await browser.newContext({ viewport: vp || { width: 1280, height: 800 } }); c.setDefaultTimeout(8000); return c; };

  const A = user('a'); const B = user('b'); const C = user('c'); const D = user('d');
  for (const e of [A, B, C, D]) await register(e);

  // ---------------------------------------------------------------- Forgot page
  let c = await ctx(); let p = await c.newPage();
  await t('forgot: empty and malformed email show field errors, no request sent', async () => {
    await p.goto(`${BASE}/forgot-password`);
    await p.getByRole('button', { name: 'Send Reset Link' }).click();
    await p.getByText('Enter your email address.').waitFor();
    await p.locator('#email').fill('abc'); await p.getByRole('button', { name: 'Send Reset Link' }).click();
    await p.getByText('Enter a valid email address.').waitFor();
  });
  let unknownText;
  await t('forgot: unknown address gets the generic notice and NO mail is sent', async () => {
    await requestLink(p, `zztest.e2e.nobody.${RUN}@example.org`);
    await p.getByText('Check your email').waitFor();
    unknownText = await p.locator('.login__notice-body').innerText();
    await new Promise((r) => setTimeout(r, 2500));
    if (mailsFor(`zztest.e2e.nobody.${RUN}@example.org`).length) throw new Error('mail sent for unknown address');
  });
  let linkA;
  await t('forgot: known address shows the IDENTICAL notice and a mail arrives with a fragment link', async () => {
    await requestLink(p, A);
    await p.getByText('Check your email').waitFor();
    const text = await p.locator('.login__notice-body').innerText();
    if (text !== unknownText) throw new Error('notice differs between known and unknown address');
    const m = await waitMail(A);
    if (!m.token || m.token.length < 40) throw new Error('no token in mail');
    if (m.body.includes(OLD) || m.body.includes(NEW)) throw new Error('password in mail');
    if (/token=/.test(m.body.replace(/#token=/g, ''))) throw new Error('token also present in a query string');
    linkA = m.token;
  });
  await c.close();

  // ---------------------------------------------------------------- Reset page
  c = await ctx(); p = await c.newPage();
  await t('reset: link opens the form and the token is removed from the address bar', async () => {
    await p.goto(`${BASE}/reset-password#token=${linkA}`);
    await p.getByRole('heading', { name: 'Choose a New Password' }).waitFor();
    if (p.url().includes('token')) throw new Error('token still in URL: ' + p.url());
  });
  await t('reset: mismatch / too short / too long are rejected client-side', async () => {
    await p.locator('#password').fill('short'); await p.locator('#confirmPassword').fill('short');
    await p.getByRole('button', { name: 'Update Password' }).click();
    await p.getByText('Password must be at least 8 characters.').waitFor();
    await p.locator('#password').fill(NEW); await p.locator('#confirmPassword').fill(NEW + 'x');
    await p.getByRole('button', { name: 'Update Password' }).click();
    await p.getByText('Passwords do not match.').waitFor();
    await p.locator('#password').fill('é'.repeat(40)); await p.locator('#confirmPassword').fill('é'.repeat(40));
    await p.getByRole('button', { name: 'Update Password' }).click();
    await p.getByText(/at most 72 bytes/).waitFor();
  });
  await t('reset: valid password updates, lands on login with a notice', async () => {
    await p.locator('#password').fill(NEW); await p.locator('#confirmPassword').fill(NEW);
    await p.getByRole('button', { name: 'Update Password' }).click();
    await p.waitForURL(/\/login\?reset=1/);
    await p.getByText('Password updated').waitFor();
  });
  await t('reset: new password signs in; old password does not', async () => {
    await login(p, A, NEW); await p.waitForURL(/dashboard/);
    const c2 = await ctx(); const p2 = await c2.newPage();
    await login(p2, A, OLD); await p2.getByText('Email or password is incorrect.').waitFor(); await c2.close();
  });
  await c.close();

  c = await ctx(); p = await c.newPage();
  await t('reuse: the same link is now rejected, with a way to request a new one', async () => {
    await p.goto(`${BASE}/reset-password#token=${linkA}`);
    await p.getByText('This link is invalid or has expired').waitFor();
    await p.getByRole('link', { name: 'Request a new reset link' }).click();
    await p.waitForURL(/forgot-password/);
  });
  await t('invalid: garbage token and missing token both show the invalid state', async () => {
    await p.goto(`${BASE}/reset-password#token=not-a-real-token`);
    await p.getByText('This link is invalid or has expired').waitFor();
    await p.goto(`${BASE}/reset-password`);
    await p.getByText('This link is invalid or has expired').waitFor();
  });
  await c.close();

  // ---------------------------------------------------------------- expiry
  if (process.env.TMS_E2E_EXPIRE_CMD) {
    c = await ctx(); p = await c.newPage();
    await t('expired: a link past its 15 minutes is rejected', async () => {
      await requestLink(p, B); const m = await waitMail(B);
      execSync(`${process.env.TMS_E2E_EXPIRE_CMD} ${B}`, { stdio: 'pipe' });
      await p.goto(`${BASE}/reset-password#token=${m.token}`);
      await p.getByText('This link is invalid or has expired').waitFor();
    });
    await c.close();
  } else skip('expired: link past 15 minutes', 'TMS_E2E_EXPIRE_CMD not set');

  // ---------------------------------------------------------------- sessions
  await t('sessions: a session opened before the reset is ended; Remember Me still works after', async () => {
    const old = await ctx(); const op = await old.newPage();
    await login(op, C, OLD); await op.waitForURL(/dashboard/);
    const other = await ctx(); const rp = await other.newPage();
    await requestLink(rp, C); const m = await waitMail(C);
    await rp.goto(`${BASE}/reset-password#token=${m.token}`);
    await rp.locator('#password').fill(NEW); await rp.locator('#confirmPassword').fill(NEW);
    await rp.getByRole('button', { name: 'Update Password' }).click(); await rp.waitForURL(/login\?reset=1/);
    await op.goto(`${BASE}/dashboard`); await op.waitForURL(/login/);                // old session is dead
    await rp.locator('#email').fill(C); await rp.locator('#password').fill(NEW);
    await rp.getByLabel('Remember me').check(); await rp.getByRole('button', { name: 'Sign In' }).click();
    await rp.waitForURL(/dashboard/);
    const cookie = (await other.cookies()).find((x) => x.name === 'tms_session');
    if (!cookie || cookie.expires === -1) throw new Error('Remember Me cookie not persistent');
    await old.close(); await other.close();
  });

  // ---------------------------------------------------------------- limits
  await t('limits: 3 mails per address per hour, further requests answer identically', async () => {
    const lc = await ctx(); const lp = await lc.newPage();
    for (let i = 0; i < 4; i++) { await requestLink(lp, D); await lp.getByText('Check your email').waitFor(); }
    await new Promise((r) => setTimeout(r, 2500));
    const n = mailsFor(D).length; if (n !== 3) throw new Error(`mails=${n}`);
    await lc.close();
  });
  await t('limits: per-IP cap shows a clear error instead of the success notice', async () => {
    const lc = await ctx(); const lp = await lc.newPage();
    let blocked = false;
    for (let i = 0; i < 8 && !blocked; i++) {
      await requestLink(lp, `zztest.e2e.flood${i}.${RUN}@example.org`);
      await lp.locator('.login__notice-title, .login__error').first().waitFor();
      blocked = (await lp.locator('.login__error').count()) > 0;
    }
    if (!blocked) throw new Error('never rate limited');
    await lp.getByText(/Too many requests/).waitFor();
    await lc.close();
  });

  // ---------------------------------------------------------------- layout
  await t('layout: forgot and reset pages have no horizontal overflow at 390px', async () => {
    const mc = await ctx({ width: 390, height: 844 }); const mp = await mc.newPage();
    for (const route of ['/forgot-password', '/reset-password#token=x']) {
      await mp.goto(`${BASE}${route}`); await mp.waitForTimeout(500);
      const o = await mp.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      if (o[0] > o[1] + 1) throw new Error(`${route}: ${o[0]} > ${o[1]}`);
    }
    await mc.close();
  });

  if (process.env.TMS_E2E_CLEANUP_CMD) { try { execSync(process.env.TMS_E2E_CLEANUP_CMD, { stdio: 'pipe' }); console.log('cleanup command ran'); } catch (e) { console.log('cleanup command failed'); } }
  await browser.close(); sink.close();
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} passed`);
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
