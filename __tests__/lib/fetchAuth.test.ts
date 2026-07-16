import { signInEmail, signOut } from '../../lib/auth/fetchAuth';

describe('fetchAuth', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('signInEmail posts to /api/auth/sign-in/email', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ user: { id: '1' } }), { status: 200 });

    const result = await signInEmail({
      email: 'a@b.com',
      password: 'secret',
      callbackURL: '/',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/sign-in/email',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          email: 'a@b.com',
          password: 'secret',
          callbackURL: '/',
          rememberMe: undefined,
        }),
      }),
    );
  });

  it('returns error message from failed sign-in', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 });

    const result = await signInEmail({ email: 'a@b.com', password: 'wrong' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Invalid credentials');
      expect(result.error.status).toBe(401);
    }
  });

  it('signOut posts to /api/auth/sign-out', async () => {
    fetchMock.mockResponseOnce('{}', { status: 200 });

    const result = await signOut();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/sign-out',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
