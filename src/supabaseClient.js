import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bxtpkqgijlkfrsobaovs.supabase.co";
const supabaseKey = "sb_publishable_K07RW_T3tTd7qx64nnw5Uw_ly7Qu3P6";

export const supabase = createClient(supabaseUrl, supabaseKey);
