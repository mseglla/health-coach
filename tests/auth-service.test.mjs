import assert from 'node:assert/strict';
import {
  AuthService,
  AuthServiceError
} from '../js/auth-service.js';
import {
  createSupabaseClient
} from '../js/supabase-client.js';
import {
  getAppBaseUrl,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL
} from '../js/supabase-config.js';

const calls = [];
let clientCreations = 0;

const session = {
  access_token: 'test-access-token',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'marc@example.com'
  }
};

const fakeClient = {
  auth: {
    async getSession() {
      calls.push(['getSession']);
      return { data: { session }, error: null };
    },

    async getUser() {
      calls.push(['getUser']);
      return { data: { user: session.user }, error: null };
    },

    async signUp(payload) {
      calls.push(['signUp', payload]);
      return {
        data: { user: session.user, session: null },
        error: null
      };
    },

    async signInWithPassword(payload) {
      calls.push(['signInWithPassword', payload]);
      return { data: { session }, error: null };
    },

    async resetPasswordForEmail(email, options) {
      calls.push(['resetPasswordForEmail', email, options]);
      return { data: {}, error: null };
    },

    async updateUser(payload) {
      calls.push(['updateUser', payload]);
      return { data: { user: session.user }, error: null };
    },

    async signOut() {
      calls.push(['signOut']);
      return { error: null };
    },

    onAuthStateChange(callback) {
      calls.push(['onAuthStateChange']);
      callback('SIGNED_IN', session);

      return {
        data: {
          subscription: {
            unsubscribe() {}
          }
        }
      };
    }
  }
};

const service = new AuthService({
  clientFactory: async () => {
    clientCreations += 1;
    return fakeClient;
  },
  redirectUrlFactory: () =>
    'http://localhost:8000/'
});

assert.equal(await service.getSession(), session);
assert.equal(await service.getUser(), session.user);
assert.equal(clientCreations, 1);

console.log('PASS — inicialitza un únic client sota demanda');
console.log('PASS — recupera sessió i usuari');

const signUpData = await service.signUp({
  email: ' marc@example.com ',
  password: 'StrongPassword1!'
});

assert.equal(signUpData.user, session.user);
assert.deepEqual(calls.at(-1), [
  'signUp',
  {
    email: 'marc@example.com',
    password: 'StrongPassword1!',
    options: {
      emailRedirectTo: 'http://localhost:8000/'
    }
  }
]);

console.log('PASS — registra amb confirmació i redirect');

assert.equal(
  await service.signIn({
    email: ' marc@example.com ',
    password: 'StrongPassword1!'
  }),
  session
);

assert.deepEqual(calls.at(-1), [
  'signInWithPassword',
  {
    email: 'marc@example.com',
    password: 'StrongPassword1!'
  }
]);

console.log('PASS — inicia sessió amb correu i contrasenya');

await service.requestPasswordReset(' marc@example.com ');

assert.deepEqual(calls.at(-1), [
  'resetPasswordForEmail',
  'marc@example.com',
  { redirectTo: 'http://localhost:8000/' }
]);

console.log('PASS — sol·licita recuperació de contrasenya');

assert.equal(
  await service.updatePassword('NewStrongPassword1!'),
  session.user
);

await service.signOut();

console.log('PASS — actualitza contrasenya i tanca sessió');

let receivedEvent = null;
const subscription = await service.subscribe(event => {
  receivedEvent = event;
});

assert.equal(receivedEvent.event, 'SIGNED_IN');
assert.equal(receivedEvent.session, session);
assert.equal(typeof subscription.unsubscribe, 'function');

console.log('PASS — publica els canvis de sessió');

await assert.rejects(
  service.signIn({ email: '', password: '' }),
  AuthServiceError
);

const failingService = new AuthService({
  clientFactory: async () => ({
    auth: {
      async getSession() {
        return {
          data: null,
          error: {
            code: 'invalid_token',
            message: 'Invalid token'
          }
        };
      }
    }
  })
});

await assert.rejects(
  failingService.getSession(),
  error =>
    error instanceof AuthServiceError &&
    error.code === 'invalid_token'
);

console.log('PASS — valida entrades i normalitza errors');

let createClientArguments = null;

const createdClient = await createSupabaseClient({
  sdkLoader: async () => ({
    createClient(...args) {
      createClientArguments = args;
      return { created: true };
    }
  })
});

assert.deepEqual(createdClient, { created: true });
assert.equal(createClientArguments[0], SUPABASE_URL);
assert.equal(
  createClientArguments[1],
  SUPABASE_PUBLISHABLE_KEY
);
assert.deepEqual(createClientArguments[2].auth, {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'pkce'
});

assert.equal(
  getAppBaseUrl({
    href: 'https://mseglla.github.io/health-coach/index.html'
  }),
  'https://mseglla.github.io/health-coach/'
);

console.log('PASS — crea el client amb configuració pública segura');
console.log('PASS — calcula correctament el redirect de GitHub Pages');
