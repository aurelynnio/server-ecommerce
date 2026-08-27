import { describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

const {
  COOKIE_NAME,
  verifyChatSession,
  resolveChatSession,
} = require('../../src/chatbot/chatSession');

describe('Chatbot anonymous session ownership', () => {
  it('creates an opaque session and stores its signed ownership token in an HTTP-only cookie', () => {
    const res = { cookie: vi.fn() };
    const sessionId = resolveChatSession({ cookies: {} }, res);

    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(verifyChatSession(res.cookie.mock.calls[0][1])).toBe(sessionId);
  });

  it('only accepts the session ID bound to the caller cookie', () => {
    const issueRes = { cookie: vi.fn() };
    const sessionId = resolveChatSession({ cookies: {} }, issueRes);
    const token = issueRes.cookie.mock.calls[0][1];
    const req = { cookies: { [COOKIE_NAME]: token } };

    expect(resolveChatSession(req, { cookie: vi.fn() }, sessionId)).toBe(sessionId);
    expect(() => resolveChatSession(req, { cookie: vi.fn() }, crypto.randomUUID())).toThrow(
      'Chat session ownership could not be verified',
    );
  });

  it('rejects a client-supplied session ID when no ownership cookie exists', () => {
    expect(() =>
      resolveChatSession({ cookies: {} }, { cookie: vi.fn() }, crypto.randomUUID()),
    ).toThrow('Chat session ownership could not be verified');
  });
});
