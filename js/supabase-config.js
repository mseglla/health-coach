export const SUPABASE_URL =
  'https://zyjzyyudftnmfjbseibi.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_IboCUET8TK_jL3TjcX1K5g_z7cZBnN0';

export const SUPABASE_SDK_VERSION = '2.110.8';

export const SUPABASE_SDK_URL =
  `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_SDK_VERSION}/dist/umd/supabase.min.js`;

export function getAppBaseUrl(
  locationRef = globalThis.location
) {
  if (!locationRef?.href) return null;
  return new URL('./', locationRef.href).href;
}
