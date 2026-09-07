from pathlib import Path
from urllib.request import Request, urlopen
import shutil
import re

BASE = "https://6a9ace9ee13f755712aab6c6--fidgital61.netlify.app"
DIST = Path("dist")

FILES = [
    "BANK_DETAILS.txt",
    "DESIGN_V27.txt",
    "FORM_ADMIN_NOTES.txt",
    "NEWS_IMAGES_SOURCES.txt",
    "NEWS_SOURCES_2025_2026.txt",
    "apply.html",
    "assets/form-config.js",
    "assets/logo.png",
    "backend/google-apps-script/Code.gs",
    "backend/google-apps-script/SETUP.txt",
    "documents/EVSK.xls",
    "documents/applications_registry_template.xlsx",
    "documents/competitions/2026/championship_ro/itogovyi_protokol_dts_championship_ro_2026.pdf",
    "documents/competitions/2026/championship_ro/itogovyi_protokol_ritm_simulyator_championship_ro_2026.pdf",
    "documents/competitions/2026/itogovyi_protokol_dts_yufo_skfo_2026.pdf",
    "documents/competitions/2026/itogovyi_protokol_ritm_simulyator_yufo_skfo_2026.pdf",
    "documents/competitions/2026/polozhenie_fidzhital_sport_2026.pdf",
    "documents/presidium/2026/protocol_prezidiuma_01_01-02-2026.pdf",
    "documents/presidium/2026/protocol_prezidiuma_02_01-03-2026.pdf",
    "documents/presidium/2026/protocol_prezidiuma_03_01-04-2026.pdf",
    "documents/presidium/2026/protocol_prezidiuma_04_15-04-2026.pdf",
    "documents/presidium/2026/protocol_prezidiuma_05_10-06-2026.pdf",
    "documents/presidium/2026/protocol_prezidiuma_06_30-06-2026.pdf",
    "documents/prikaz_o_gosudarstvennoy_akkreditacii.pdf",
    "documents/ranks/primer_predstavleniya_2_razryad.docx",
    "documents/ranks/shablon_hodataystvo_2_3_razryad.docx",
    "documents/regulations/2026/polozhenie_II_III_razryady_01-04-2026.pdf",
    "documents/regulations/2026/polozhenie_I_KMS_MS_30-06-2026.pdf",
    "documents/regulations/2026/polozhenie_sudeyskiy_komitet_15-04-2026.pdf",
    "documents/regulations/2026/polozhenie_trenerskiy_sovet_01-03-2026.pdf",
    "documents/svidetelstvo_minjust.pdf",
    "documents/ustav_federacii.pdf",
    "index.html",
    "privacy.html",
]


def download(path: str):
    dest = DIST / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = Request(f"{BASE}/{path}", headers={"User-Agent": "fidgital61-netlify-build/1.0"})
    with urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    print("downloaded", path)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Build patch failed: {label}")
    return text.replace(old, new, 1)


if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir(parents=True)

for file_path in FILES:
    download(file_path)

# -----------------------------------------------------------------------------
# Configuration of applications: ONLY open regional events of Rostov Region.
# -----------------------------------------------------------------------------
config = '''window.FORM_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbxqSuADSV8adQxbS40l1JJJl6aTI3Zbpo2GUdw16x-4hbdSQN4f6dmXTCWU5U4RIhvV/exec",
  federationEmail: "zayavkafidgital@internet.ru",
  competitions: [
    {
      name: "Кубок Ростовской области по фиджитал-спорту 2026",
      level: "regional",
      region: "Ростовская область",
      status: "open",
      disciplines: ["DTS", "Ритм-симулятор"]
    },
    {
      name: "Открытый фестиваль «Кубок ТЦ „Мега“» по ритм-симулятору",
      level: "regional",
      region: "Ростовская область",
      status: "open",
      disciplines: ["Ритм-симулятор"]
    }
  ]
};
'''
(DIST / "assets/form-config.js").write_text(config, encoding="utf-8")

# -----------------------------------------------------------------------------
# Application page patches.
# Internal value DTS is intentionally retained for compatibility with Apps Script.
# -----------------------------------------------------------------------------
apply_path = DIST / "apply.html"
html = apply_path.read_text(encoding="utf-8")
html = html.replace("<span>DTS</span>", "<span>ДТС</span>")
html = html.replace("команда DTS или спортсмен", "команда ДТС или спортсмен")
html = html.replace('<span class="tag">DTS</span>', '<span class="tag">ДТС</span>')

old_select = '''<select id="discipline" required>
<option value="">— Выберите —</option>
<option value="DTS">Команда DTS — двоеборье «тактическая стрельба»</option>
<option value="Ритм-симулятор">Ритм-симулятор — спортсмен</option>
</select>'''
new_select = '''<select id="discipline" required disabled>
<option value="">— Сначала выберите соревнование —</option>
</select>'''
if old_select in html:
    html = html.replace(old_select, new_select, 1)
else:
    html = re.sub(
        r'<select id="discipline" required>\s*<option value="">— Выберите —</option>\s*<option value="DTS">.*?</option>\s*<option value="Ритм-симулятор">.*?</option>\s*</select>',
        new_select,
        html,
        count=1,
        flags=re.S,
    )

marker = "const discipline = document.getElementById('discipline');"
if "function loadDisciplinesForCompetition()" not in html:
    dynamic = '''const discipline = document.getElementById('discipline');

function disciplineLabel(value){
  if(value === 'DTS') return 'Команда ДТС — двоеборье «тактическая стрельба»';
  if(value === 'Ритм-симулятор') return 'Ритм-симулятор — спортсмен';
  return value;
}

function loadDisciplinesForCompetition(){
  const items = (window.FORM_CONFIG && Array.isArray(window.FORM_CONFIG.competitions))
    ? window.FORM_CONFIG.competitions
    : [];
  const selected = items.find(item =>
    item && item.name === competition.value && item.status === 'open'
  );

  discipline.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = selected ? '— Выберите формат участия —' : '— Сначала выберите соревнование —';
  discipline.appendChild(first);

  if(!selected){
    discipline.disabled = true;
    setMode();
    return;
  }

  (selected.disciplines || []).forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = disciplineLabel(value);
    discipline.appendChild(option);
  });
  discipline.disabled = false;
  setMode();
}

competition.addEventListener('change', loadDisciplinesForCompetition);'''
    html = replace_once(html, marker, dynamic, "discipline JS marker")

html = html.replace("discipline.addEventListener('change', setMode);\nsetMode();",
                    "discipline.addEventListener('change', setMode);\nloadDisciplinesForCompetition();")

if "function selectedDisciplineIsAllowed()" not in html:
    validation = '''function selectedDisciplineIsAllowed(){
  const items = (window.FORM_CONFIG && Array.isArray(window.FORM_CONFIG.competitions))
    ? window.FORM_CONFIG.competitions
    : [];
  const selected = items.find(item => item && item.name === competition.value && item.status === 'open');
  return !!selected && Array.isArray(selected.disciplines) && selected.disciplines.includes(discipline.value);
}

'''
    html = replace_once(html, "function buildPayload(){", validation + "function buildPayload(){", "buildPayload marker")

check_line = "if(!selectedCompetitionIsOpen()) return alert('Выберите открытое региональное соревнование Ростовской области.');"
allowed_line = "if(!selectedDisciplineIsAllowed()) return alert('Выберите доступный формат участия для этого соревнования.');"
if allowed_line not in html:
    html = html.replace(check_line, check_line + "\n  " + allowed_line)

apply_path.write_text(html, encoding="utf-8")

# -----------------------------------------------------------------------------
# Home page: add the Mega festival and open the Rostov Region Cup applications.
# -----------------------------------------------------------------------------
index_path = DIST / "index.html"
idx = index_path.read_text(encoding="utf-8")
festival = '''      <div class="event">
        <div class="date">приём<br>открыт</div>
        <div><h3>Открытый фестиваль «Кубок ТЦ „Мега“»</h3><p>Ритм-симулятор • региональное мероприятие Федерации • приём заявок открыт.</p></div>
        <a class="link" href="apply.html">Подать заявку →</a>
      </div>
'''
if "Открытый фестиваль «Кубок ТЦ „Мега“»" not in idx:
    championship = '''      <div class="event">
        <div class="date">21–25<br>сентября</div>'''
    idx = replace_once(idx, championship, festival + championship, "championship event marker")

idx = idx.replace(
    '<div><h3>Кубок Ростовской области</h3><p>Информация о дате и месте проведения будет опубликована дополнительно.</p></div>\n        <a class="link" href="#">Подробнее →</a>',
    '<div><h3>Кубок Ростовской области</h3><p>Приём заявок открыт. Информация о дате и месте проведения будет опубликована дополнительно.</p></div>\n        <a class="link" href="apply.html">Подать заявку →</a>',
    1,
)
index_path.write_text(idx, encoding="utf-8")

print("Site build complete:", DIST.resolve())
