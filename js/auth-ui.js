import { authService } from './auth-service.js';

export function hasAuthCallback(
  locationRef = globalThis.location
) {
  if (!locationRef) return false;

  const search = new URLSearchParams(
    locationRef.search || ''
  );
  const hash = new URLSearchParams(
    String(locationRef.hash || '').replace(/^#/, '')
  );

  return (
    search.has('code') ||
    search.get('type') === 'recovery' ||
    hash.has('access_token') ||
    hash.get('type') === 'recovery'
  );
}

export function isNewPasswordValid(password) {
  return typeof password === 'string' &&
    password.length >= 10;
}

export function authErrorMessage(error) {
  const code = error?.code || '';

  const messages = {
    invalid_credentials:
      'El correu o la contrasenya no són correctes.',
    email_not_confirmed:
      'Confirma el correu abans d’iniciar sessió.',
    user_already_exists:
      'Ja existeix un compte amb aquest correu.',
    over_email_send_rate_limit:
      'S’han enviat massa correus. Torna-ho a provar més tard.'
  };

  return messages[code] ||
    error?.message ||
    'No s’ha pogut completar l’operació.';
}

export class AuthUiController {
  constructor({
    service,
    elements,
    notify = () => {},
    onSessionChange = () => {}
  }) {
    this.service = service;
    this.elements = elements;
    this.notify = notify;
    this.onSessionChange = onSessionChange;
    this.session = null;
    this.recoveryMode = false;
    this.initialized = false;
    this.initializePromise = null;
    this.subscription = null;

    this.bind();
    this.render();
  }

  bind() {
    this.elements.form.addEventListener(
      'submit',
      event => {
        event.preventDefault();
        this.signIn();
      }
    );

    this.elements.signUp.addEventListener(
      'click',
      () => this.signUp()
    );

    this.elements.forgotPassword.addEventListener(
      'click',
      () => this.requestPasswordReset()
    );

    this.elements.signOut.addEventListener(
      'click',
      () => this.signOut()
    );

    this.elements.recoveryForm.addEventListener(
      'submit',
      event => {
        event.preventDefault();
        this.updatePassword();
      }
    );

    this.elements.cancelRecovery.addEventListener(
      'click',
      () => {
        this.recoveryMode = false;
        this.render();
      }
    );
  }

  notifySessionChange() {
    return Promise.resolve(
      this.onSessionChange(this.session)
    ).catch(error => {
      this.notify(
        error?.message || 'No s’han pogut carregar els pesos del compte'
      );
    });
  }

  setStatus(label, tone) {
    this.elements.status.textContent = label;
    this.elements.status.className =
      `status-pill status-pill--${tone}`;
  }

  setBusy(busy) {
    [
      this.elements.signIn,
      this.elements.signUp,
      this.elements.forgotPassword,
      this.elements.signOut,
      ...this.elements.recoveryForm.querySelectorAll('button')
    ].forEach(button => {
      button.disabled = busy;
    });
  }

  render() {
    const signedIn = Boolean(this.session);

    this.elements.signedOut.hidden =
      signedIn || this.recoveryMode;
    this.elements.signedIn.hidden =
      !signedIn || this.recoveryMode;
    this.elements.recovery.hidden =
      !this.recoveryMode;

    if (this.recoveryMode) {
      this.setStatus('RECUPERACIÓ', 'warn');
      this.elements.description.textContent =
        'Introdueix una contrasenya nova per recuperar el compte.';
      return;
    }

    if (signedIn) {
      this.setStatus('CONNECTAT', 'good');
      this.elements.description.textContent =
        'Els pesos del compte es guarden i es carreguen des de Supabase.';
      this.elements.userEmail.textContent =
        this.session.user?.email || '';
      return;
    }

    this.setStatus('SESSIÓ TANCADA', 'neutral');
    this.elements.description.textContent =
      'Inicia sessió per carregar i guardar les dades del teu compte.';
    this.elements.userEmail.textContent = '';
  }

  renderConnectionError() {
    this.setStatus('SENSE CONNEXIÓ', 'bad');
    this.elements.description.textContent =
      'No s’ha pogut connectar amb ATLES. Comprova la connexió i torna-ho a provar.';
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.setStatus('CONNECTANT', 'warn');

    this.initializePromise = (async () => {
      try {
        this.subscription = await this.service.subscribe(
          ({ event, session }) => {
            if (event === 'PASSWORD_RECOVERY') {
              this.session = session;
              this.recoveryMode = true;
            } else if (event === 'SIGNED_OUT') {
              this.session = null;
              this.recoveryMode = false;
            } else if (
              event === 'SIGNED_IN' ||
              event === 'TOKEN_REFRESHED' ||
              event === 'USER_UPDATED'
            ) {
              this.session = session;
            }

            this.render();
            this.notifySessionChange();
          }
        );

        const currentSession =
          await this.service.getSession();

        if (currentSession) {
          this.session = currentSession;
        }

        this.initialized = true;
        this.render();
        await this.notifySessionChange();
      } catch (error) {
        this.renderConnectionError();
        throw error;
      } finally {
        this.initializePromise = null;
      }
    })();

    return this.initializePromise;
  }

  credentialsAreValid() {
    return this.elements.form.reportValidity();
  }

  async run(operation) {
    this.setBusy(true);

    try {
      await this.initialize();
      await operation();
    } catch (error) {
      this.notify(authErrorMessage(error));
    } finally {
      this.setBusy(false);
    }
  }

  signIn() {
    if (!this.credentialsAreValid()) return;

    return this.run(async () => {
      const session = await this.service.signIn({
        email: this.elements.email.value,
        password: this.elements.password.value
      });

      this.session = session;
      this.elements.password.value = '';
      this.render();
      await this.notifySessionChange();
      this.notify('Sessió iniciada correctament');
    });
  }

  signUp() {
    if (!this.credentialsAreValid()) return;

    if (!isNewPasswordValid(this.elements.password.value)) {
      this.notify(
        'La contrasenya nova ha de tenir un mínim de 10 caràcters.'
      );
      return;
    }

    return this.run(async () => {
      const data = await this.service.signUp({
        email: this.elements.email.value,
        password: this.elements.password.value
      });

      this.elements.password.value = '';

      if (data?.session) {
        this.session = data.session;
        this.render();
        await this.notifySessionChange();
        this.notify('Compte creat i sessió iniciada');
      } else {
        this.notify(
          'Compte creat. Revisa el correu per confirmar-lo.'
        );
      }
    });
  }

  requestPasswordReset() {
    if (!this.elements.email.reportValidity()) return;

    return this.run(async () => {
      await this.service.requestPasswordReset(
        this.elements.email.value
      );

      this.notify(
        'T’hem enviat un correu per recuperar la contrasenya.'
      );
    });
  }

  signOut() {
    return this.run(async () => {
      await this.service.signOut();
      this.session = null;
      this.recoveryMode = false;
      this.render();
      await this.notifySessionChange();
      this.notify('Sessió tancada');
    });
  }

  updatePassword() {
    if (!this.elements.recoveryForm.reportValidity()) {
      return;
    }

    if (!isNewPasswordValid(
      this.elements.newPassword.value
    )) {
      this.notify(
        'La contrasenya nova ha de tenir un mínim de 10 caràcters.'
      );
      return;
    }

    return this.run(async () => {
      await this.service.updatePassword(
        this.elements.newPassword.value
      );

      this.elements.newPassword.value = '';
      this.recoveryMode = false;
      this.render();
      this.notify('Contrasenya actualitzada');
    });
  }
}

export function createAuthUi({
  service = authService,
  documentRef = document,
  notify,
  onSessionChange
} = {}) {
  return new AuthUiController({
    service,
    notify,
    onSessionChange,
    elements: {
      status: documentRef.getElementById('authStatus'),
      description:
        documentRef.getElementById('authDescription'),
      signedOut:
        documentRef.getElementById('authSignedOut'),
      signedIn:
        documentRef.getElementById('authSignedIn'),
      recovery:
        documentRef.getElementById('authRecovery'),
      form: documentRef.getElementById('authForm'),
      email: documentRef.getElementById('authEmail'),
      password:
        documentRef.getElementById('authPassword'),
      signIn:
        documentRef.getElementById('authSignIn'),
      signUp:
        documentRef.getElementById('authSignUp'),
      forgotPassword:
        documentRef.getElementById('authForgotPassword'),
      userEmail:
        documentRef.getElementById('authUserEmail'),
      signOut:
        documentRef.getElementById('authSignOut'),
      recoveryForm:
        documentRef.getElementById('authRecoveryForm'),
      newPassword:
        documentRef.getElementById('authNewPassword'),
      cancelRecovery:
        documentRef.getElementById('authCancelRecovery')
    }
  });
}
