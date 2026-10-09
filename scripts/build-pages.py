"""Build an allowlisted static preview; never copy local server data or credentials."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
source = root / 'outputs/qiban-growth-prototype'
target = root / 'docs'
target.mkdir(exist_ok=True)
files = ['index.html', 'style.css', 'research-cards.css', 'app.js',
         'attachment-input.js', 'stage-state.js', 'record-input.js', 'action-state.js',
         'home-state.js', 'expedition-data.js', 'research-cards.js', 'home-ui.js',
         'assets/qixi-editorial.png']
for name in files:
    out = target / name
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source / name, out)
p = target / 'index.html'
p.write_text(p.read_text().replace('</head>', '<meta name="qiban-static-preview" content="true"></head>'))
(target / '.nojekyll').write_text('')
print('GitHub Pages preview: docs/index.html')
