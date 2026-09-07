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
  const isProduction = context?.deploy?.context === "production";
  return isProduction
    ? getStore("athlete-directory", { consistency: "strong" })
    : getDeployStore("athlete-directory");
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
      const athlete = await store.get(blob.key, { type: "json" });
      if (!athlete) continue;
      const haystack = normalizeText([
        athlete.lastName,
        athlete.firstName,
        athlete.middleName,
        athlete.nickname
      ].filter(Boolean).join(" "));
      if (haystack.includes(query)) results.push(athlete);
      if (results.length >= 12) break;
    }

    results.sort((a, b) => {
      const aa = normalizeText(`${a.lastName} ${a.firstName}`);
      const bb = normalizeText(`${b.lastName} ${b.firstName}`);
      return aa.localeCompare(bb, "ru");
    });

    return Response.json({ ok: true, results: results.slice(0, 8) });
  } catch {
    return Response.json({ ok: true, results: [] });
  }
};

export const config = { path: "/api/athletes" };
