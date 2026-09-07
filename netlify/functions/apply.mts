import { getDeployStore, getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ALLOWED = new Map([
  ["Кубок Ростовской области по фиджитал-спорту 2026", new Set(["DTS", "Ритм-симулятор"])],
  ["Открытый фестиваль «Кубок ТЦ „Мега“» по ритм-симулятору", new Set(["Ритм-симулятор"])]
]);

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

function scopedStore(name: string, context: any) {
  const deployContext = Netlify.context?.deploy?.context || context?.deploy?.context || "";
  const isProduction = deployContext === "production";
  return isProduction
    ? getStore(name, { consistency: "strong" })
    : getDeployStore(name);
}

function contactHash(contact: any) {
  return hash(`${normalizeEmail(contact?.email)}|${normalizePhone(contact?.phone)}`);
}

function athleteHash(athlete: any) {
  return hash([
    normalizeText(athlete?.lastName),
    normalizeText(athlete?.firstName),
    normalizeText(athlete?.middleName),
    String(athlete?.birthDate || "")
  ].join("|"));
}

async function saveAthletes(payload: any, context: any) {
  const store = scopedStore("athlete-directory", context);
  const owner = contactHash(payload.contact || {});
  const now = new Date().toISOString();
  const seen = new Set<string>();

  for (const athlete of Array.isArray(payload.athletes) ? payload.athletes : []) {
    const key = athleteHash(athlete);
    if (seen.has(key)) continue;
    seen.add(key);

    await store.setJSON(`${owner}/${key}`, {
      lastName: String(athlete.lastName || "").trim(),
      firstName: String(athlete.firstName || "").trim(),
      middleName: String(athlete.middleName || "").trim(),
      birthDate: String(athlete.birthDate || "").trim(),
      nickname: String(athlete.nickname || "").trim(),
      lastTeamName: String(athlete.teamName || payload.teamName || "").trim(),
      lastCompetition: String(payload.competition || "").trim(),
      lastDiscipline: String(payload.discipline || "").trim(),
      updatedAt: now
    });
  }
}

async function postToGoogle(endpoint: string, payload: any) {
  const body = new URLSearchParams();
  body.set("payload", JSON.stringify(payload));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });

  const text = await response.text();
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch {}
  return response.ok && parsed?.ok === true;
}

async function syncGoogleSheets(payload: any) {
  const endpoint = Netlify.env.get("GOOGLE_APPS_SCRIPT_ENDPOINT");
  if (!endpoint) return false;

  try {
    if (payload.discipline === "DTS" && Array.isArray(payload.teams) && payload.teams.length) {
      const results: boolean[] = [];
      for (let i = 0; i < payload.teams.length; i++) {
        const team = payload.teams[i];
        const legacyPayload = {
          ...payload,
          submissionId: `${payload.submissionId}-T${i + 1}`,
          teamName: String(team.teamName || ""),
          teams: [],
          athletes: Array.isArray(team.athletes) ? team.athletes : []
        };
        results.push(await postToGoogle(endpoint, legacyPayload));
      }
      return results.length > 0 && results.every(Boolean);
    }

    return await postToGoogle(endpoint, { ...payload, teams: [] });
  } catch {
    return false;
  }
}

function validate(payload: any) {
  if (!payload || typeof payload !== "object") return "Некорректная заявка.";
  if (!payload.submissionId || !payload.competition || !payload.discipline) return "Не заполнены обязательные параметры заявки.";
  const formats = ALLOWED.get(String(payload.competition));
  if (!formats || !formats.has(String(payload.discipline))) return "Приём заявок на выбранное соревнование или формат закрыт.";

  const contact = payload.contact || {};
  if (!normalizeEmail(contact.email) || normalizePhone(contact.phone).length < 6) return "Укажите e-mail и телефон контактного лица.";

  const athletes = Array.isArray(payload.athletes) ? payload.athletes : [];
  if (!athletes.length) return "В заявке нет спортсменов.";

  if (payload.discipline === "DTS") {
    const teams = Array.isArray(payload.teams) ? payload.teams : [];
    if (!teams.length) return "Добавьте хотя бы одну команду ДТС.";
    for (const team of teams) {
      if (!String(team?.teamName || "").trim()) return "У каждой команды ДТС должно быть название.";
      const mains = (Array.isArray(team?.athletes) ? team.athletes : []).filter((a: any) => String(a?.role || "").startsWith("Основной"));
      if (mains.length !== 5) return `В команде «${team.teamName}» должно быть 5 основных спортсменов.`;
    }
  }

  return "";
}

export default async (req: Request, context: any) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const payload = await req.json();
    const error = validate(payload);
    if (error) return Response.json({ ok: false, error }, { status: 400 });

    const applications = scopedStore("applications", context);
    await applications.setJSON(String(payload.submissionId), {
      ...payload,
      receivedAt: new Date().toISOString()
    });

    await saveAthletes(payload, context);
    const googleSheetsSynced = await syncGoogleSheets(payload);

    return Response.json({
      ok: true,
      id: payload.submissionId,
      googleSheetsSynced
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || "Ошибка сервера" }, { status: 500 });
  }
};

export const config = { path: "/api/apply" };
