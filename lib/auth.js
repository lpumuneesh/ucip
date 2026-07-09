import crypto from 'crypto';
import nodemailer from 'nodemailer';

let _transport = null;
function transport() {
  if (_transport === null) {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      _transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    } else {
      _transport = false; // no smtp configured
    }
  }
  return _transport;
}

export async function sendOtpEmail(to, code) {
  const t = transport();
  const subject = 'Your UCIP verification code';
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width:520px; margin:0 auto; padding:24px; background:#0b0b0f; color:#e5e5e5; border-radius:16px;">
      <h2 style="color:#fff; margin:0 0 8px">UCIP Sign-in</h2>
      <p style="color:#a1a1aa; margin:0 0 24px">Use the code below to sign in to the University Competitor Intelligence Platform.</p>
      <div style="font-size:36px; font-weight:700; letter-spacing:6px; color:#818cf8; background:#1f1f2e; padding:16px 24px; border-radius:12px; text-align:center; border:1px solid #ffffff1a;">${code}</div>
      <p style="color:#71717a; margin:24px 0 0; font-size:12px">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  const text = `Your UCIP verification code is: ${code}\n\nThis code expires in 10 minutes.`;

  // Always log to server console for developer visibility
  console.log(`[OTP] ${to} -> ${code}`);

  if (!t) {
    return { sent: false, dev: true, reason: 'SMTP not configured; OTP logged to server console' };
  }
  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || `UCIP <${process.env.SMTP_USER}>`,
      to, subject, html, text,
    });
    return { sent: true, dev: false, messageId: info.messageId };
  } catch (e) {
    console.error('[OTP mail error]', e.message);
    return { sent: false, dev: true, reason: e.message };
  }
}

export function hashCode(code, salt) {
  return crypto.createHmac('sha256', salt || 'ucip').update(code).digest('hex');
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export const ALLOWED_DOMAIN = 'lpu.co.in';

export function isAllowedEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return false;
  return e.endsWith('@' + ALLOWED_DOMAIN);
}

export async function getSessionUser(db, request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const session = await db.collection('sessions').findOne({ token });
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    await db.collection('sessions').deleteOne({ token });
    return null;
  }
  const user = await db.collection('users').findOne({ id: session.userId });
  if (!user || user.status !== 'active') return null;
  return user;
}
