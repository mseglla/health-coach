import { createSupabaseClient } from './supabase-client.js';
import { getAppBaseUrl } from './supabase-config.js';

export class AuthServiceError extends Error {
  constructor(message, { code = null, cause = null } = {}) {
    super(message, { cause });
    this.name = 'AuthServiceError';
    this.code = code;
  }
}

function requireValue(value, fieldName) {
  if (!String(value || '').trim()) {
    throw new AuthServiceError(`${fieldName} is required`);
  }
}

export class AuthService {
  constructor({
    clientFactory = createSupabaseClient,
    redirectUrlFactory = getAppBaseUrl
  } = {}) {
    this.clientFactory = clientFactory;
    this.redirectUrlFactory = redirectUrlFactory;
    this.clientPromise = null;
  }

  async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = Promise.resolve()
        .then(() => this.clientFactory())
        .catch(error => {
          this.clientPromise = null;
          throw error;
        });
    }

    return this.clientPromise;
  }

  async unwrap(operation) {
    let result;

    try {
      result = await operation();
    } catch (error) {
      throw new AuthServiceError(
        error?.message || 'Authentication request failed',
        { cause: error }
      );
    }

    if (result?.error) {
      throw new AuthServiceError(
        result.error.message || 'Authentication request failed',
        {
          code: result.error.code || null,
          cause: result.error
        }
      );
    }

    return result?.data ?? null;
  }

  async getSession() {
    const client = await this.getClient();
    const data = await this.unwrap(
      () => client.auth.getSession()
    );

    return data?.session || null;
  }

  async getUser() {
    const client = await this.getClient();
    const data = await this.unwrap(
      () => client.auth.getUser()
    );

    return data?.user || null;
  }

  async signUp({ email, password }) {
    requireValue(email, 'Email');
    requireValue(password, 'Password');

    const client = await this.getClient();
    const redirectTo = this.redirectUrlFactory();

    return this.unwrap(() => client.auth.signUp({
      email: email.trim(),
      password,
      options: redirectTo
        ? { emailRedirectTo: redirectTo }
        : undefined
    }));
  }

  async signIn({ email, password }) {
    requireValue(email, 'Email');
    requireValue(password, 'Password');

    const client = await this.getClient();
    const data = await this.unwrap(
      () => client.auth.signInWithPassword({
        email: email.trim(),
        password
      })
    );

    return data?.session || null;
  }

  async requestPasswordReset(email) {
    requireValue(email, 'Email');

    const client = await this.getClient();
    const redirectTo = this.redirectUrlFactory();

    await this.unwrap(
      () => client.auth.resetPasswordForEmail(
        email.trim(),
        redirectTo ? { redirectTo } : undefined
      )
    );
  }

  async updatePassword(password) {
    requireValue(password, 'Password');

    const client = await this.getClient();
    const data = await this.unwrap(
      () => client.auth.updateUser({ password })
    );

    return data?.user || null;
  }

  async signOut() {
    const client = await this.getClient();
    await this.unwrap(() => client.auth.signOut());
  }

  async subscribe(listener) {
    const client = await this.getClient();
    const { data } = client.auth.onAuthStateChange(
      (event, session) => listener({ event, session })
    );

    return data.subscription;
  }
}

export const authService = new AuthService();
