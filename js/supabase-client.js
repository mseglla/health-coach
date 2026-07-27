import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SDK_URL,
  SUPABASE_URL
} from './supabase-config.js';

let sdkPromise = null;

export function loadSupabaseSdk({
  globalRef = globalThis,
  documentRef = globalThis.document,
  sdkUrl = SUPABASE_SDK_URL
} = {}) {
  if (globalRef.supabase?.createClient) {
    return Promise.resolve(globalRef.supabase);
  }

  if (!documentRef) {
    return Promise.reject(
      new Error('Supabase SDK requires a browser document')
    );
  }

  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = documentRef.createElement('script');
    script.src = sdkUrl;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.atlesSupabaseSdk = 'true';

    script.addEventListener('load', () => {
      if (globalRef.supabase?.createClient) {
        resolve(globalRef.supabase);
        return;
      }

      sdkPromise = null;
      reject(new Error('Supabase SDK loaded without createClient'));
    });

    script.addEventListener('error', () => {
      sdkPromise = null;
      reject(new Error('Could not load Supabase SDK'));
    });

    documentRef.head.append(script);
  });

  return sdkPromise;
}

export async function createSupabaseClient({
  url = SUPABASE_URL,
  publishableKey = SUPABASE_PUBLISHABLE_KEY,
  sdkLoader = loadSupabaseSdk
} = {}) {
  if (!url || !publishableKey) {
    throw new Error('Supabase public configuration is incomplete');
  }

  const sdk = await sdkLoader();

  return sdk.createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
}
