import { getDeployStore, getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("ru-RU");
}

function scopedStore(context: any) {
  const deployContext = Netlify.context?.deploy?.context || context?.deploy?.context || "";
  const isProduction = deployContext === "production";
  return isProduction
    ? getStore("team-directory", { consistency: "strong" })
    : getDeployStore("team-directory");
}

export default async (req: Request, context: any) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const phone = normalizePhone(body?.phone);
    const query = normalizeText(body?.query);

    if (!email || phone.length < 6 || query.length < 1) {
      return Response.json({ ok: true, results: [] });
    }

    const owner = hash(`${email}|${phone}`);
    const store = scopedStore(context);
    const listed = await store.list({ prefix: `${owner}/` });
    const results: any[] = [];

    for (const blob of listed.blobs) {
      const team = await store.get(blob.key, { type: "json" });
      if (!team) continue;
      const teamName = normalizeText(team.teamName);
      if (teamName.includes(query)) results.push(team);
      if (results.length >= 12) break;
    }

    results.sort((a, b) => normalizeText(a.teamName).localeCompare(normalizeText(b.teamName), "ru"));
    return Response.json({ ok: true, results: results.slice(0, 8) });
  } catch {
    return Response.json({ ok: true, results: [] });
  }
};

export const config = { path: "/api/teams" };