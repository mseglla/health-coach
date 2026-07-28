import assert from 'node:assert/strict';
import {
  authErrorMessage,
  hasAuthCallback,
  isNewPasswordValid
} from '../js/auth-ui.js';

assert.equal(
  hasAuthCallback({
    search: '?code=test-code',
    hash: ''
  }),
  true
);

assert.equal(
  hasAuthCallback({
    search: '',
    hash: '#type=recovery&access_token=test'
  }),
  true
);

assert.equal(
  hasAuthCallback({
    search: '',
    hash: ''
  }),
  false
);

assert.equal(
  isNewPasswordValid('1234567890'),
  true
);

assert.equal(
  isNewPasswordValid('abcdefghij'),
  true
);

assert.equal(
  isNewPasswordValid('12345'),
  false
);

console.log('PASS — valida només el mínim de 10 caràcters');

console.log('PASS — detecta callbacks d’autenticació');
console.log('PASS — no activa Auth en una obertura local normal');

assert.equal(
  authErrorMessage({
    code: 'invalid_credentials',
    message: 'technical message'
  }),
  'El correu o la contrasenya no són correctes.'
);

assert.equal(
  authErrorMessage({
    code: 'email_not_confirmed'
  }),
  'Confirma el correu abans d’iniciar sessió.'
);

assert.equal(
  authErrorMessage({
    message: 'Error desconegut'
  }),
  'Error desconegut'
);

console.log('PASS — tradueix errors coneguts');
console.log('PASS — conserva errors desconeguts');
