import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://bxtpkqgijlkfrsobaovs.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K07RW_T3tTd7qx64nnw5Uw_ly7Qu3P6";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
