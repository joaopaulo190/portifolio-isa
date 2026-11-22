// =====================================================================
//  Configuração do Supabase
//  Pegue esses dois valores em: Supabase > Project Settings > API
//  (a chave "anon public" pode ficar no site, ela é pública por natureza;
//   quem protege os dados são as regras do arquivo supabase/schema.sql)
// =====================================================================
window.SITE_CONFIG = {
  SUPABASE_URL: "https://pedqwpsbdczekzthqcxy.supabase.co",       // só o endereço, sem /rest/v1
  SUPABASE_ANON_KEY: "sb_publishable_oAp4uFMKzS-YpYB86jXtCA_lMiN0jzv",
};

window.SITE_CONFIG.SUPABASE_URL = window.SITE_CONFIG.SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

window.SITE_CONFIG.ready =
  !window.SITE_CONFIG.SUPABASE_URL.startsWith("COLE_") &&
  !window.SITE_CONFIG.SUPABASE_ANON_KEY.startsWith("COLE_");
