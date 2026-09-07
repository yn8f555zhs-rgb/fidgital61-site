from pathlib import Path
import shutil

DIST = Path('dist')
LOCAL_FILES = [
    'index.html',
    'federation.html',
    'competitions.html',
    'documents.html',
    'team.html',
    'contacts.html',
    'apply.html',
    'privacy.html',
    'assets/apply.js',
    'assets/style.css',
    'assets/site-sections.css',
    'assets/form-config.js',
    'backend/google-apps-script/Code.gs',
]

for rel in LOCAL_FILES:
    src = Path(rel)
    dst = DIST / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print('local source copied', rel)
