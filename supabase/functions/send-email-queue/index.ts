// Supabase Edge Function — send pending rows from email_queue via Resend
// Deploy: supabase functions deploy send-email-queue
// Secrets: RESEND_API_KEY, optional RESEND_FROM="LeaseAccom <onboarding@resend.dev>"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("RESEND_FROM") || "LeaseAccom <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async () => {
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Missing secrets" }), { status: 500 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: rows, error } = await sb
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results = [];
  for (const row of rows || []) {
    let to = row.to_email;
    if (!to && row.user_id) {
      const { data: userData } = await sb.auth.admin.getUserById(row.user_id);
      to = userData?.user?.email || null;
      if (!to) {
        const { data: prof } = await sb.from("profiles").select("email").eq("id", row.user_id).maybeSingle();
        to = prof?.email || null;
      }
    }
    if (!to) {
      await sb.from("email_queue").update({ status: "failed", error: "No email address" }).eq("id", row.id);
      results.push({ id: row.id, ok: false, error: "no email" });
      continue;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: row.subject,
        text: row.body,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      await sb.from("email_queue").update({ status: "failed", error: errText }).eq("id", row.id);
      results.push({ id: row.id, ok: false, error: errText });
    } else {
      await sb
        .from("email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString(), to_email: to })
        .eq("id", row.id);
      results.push({ id: row.id, ok: true });
    }
  }
  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
