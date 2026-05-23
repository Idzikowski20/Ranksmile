// Mock for @neondatabase/auth/next — avoids ESM SyntaxError in Jest
export const createAuthClient = () => ({
  signIn: { email: () => Promise.resolve({ data: {}, error: null }) },
  signUp: { email: () => Promise.resolve({ data: {}, error: null }) },
  signOut: () => Promise.resolve({ data: {}, error: null }),
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  useSession: () => ({ data: { session: null }, isPending: false, error: null }),
});
