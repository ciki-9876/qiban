"""Build one offline, self-contained HTML document. No third-party packages."""
from pathlib import Path
import base64
import json

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
css = (root / 'style.css').read_text()
source_js = (root / 'app.js').read_text()
js = source_js
mascot = 'data:image/png;base64,' + base64.b64encode((root / 'assets/qixi-editorial.png').read_bytes()).decode()
js = js.replace("'assets/qixi-editorial.png'", repr(mascot))
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script src="attachment-input.js"></script>', '<script>\n' + (root / 'attachment-input.js').read_text() + '\n</script>')
html = html.replace('<script src="stage-state.js"></script>', '<script>\n' + (root / 'stage-state.js').read_text() + '\n</script>')
html = html.replace('<script src="record-input.js"></script>', '<script>\n' + (root / 'record-input.js').read_text() + '\n</script>')
html = html.replace('<script src="action-state.js"></script>', '<script>\n' + (root / 'action-state.js').read_text() + '\n</script>')
for name in ['home-state.js', 'expedition-data.js', 'research-cards.js', 'home-ui.js', 'project-state.js']:
    html = html.replace(f'<script src="{name}"></script>', '<script>\n' + (root / name).read_text() + '\n</script>')
html = html.replace('<script src="app.js"></script>', '<script>\n' + js + '\n</script>')
html = html.replace('<link rel="stylesheet" href="research-cards.css">', '<style>\n' + (root / 'research-cards.css').read_text() + '\n</style>')
html = html.replace('<link rel="stylesheet" href="project.css">', '<style>\n' + (root / 'project.css').read_text() + '\n</style>')
target = root.parent / '栖伴-目标成长交互原型.html'
target.write_text(html)
print(f'{target} ({target.stat().st_size:,} bytes)')

# Keep the action's independent deliverable in sync with the actual homepage.
function_start = source_js.index('  function breathingMascot(){')
function_end = source_js.index('  function renderNow(){', function_start)
portrait_function = source_js[function_start:function_end]
breathing_css = css.split('/* A quiet four-second breath. Keep the book, ground and caption stationary. */', 1)[1]
component = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fafaf7"><title>栖栖 · 安静呼吸</title><style>html,body{margin:0;min-height:100%;background:#fafaf7}body{min-height:100vh;display:grid;place-items:center}.hero-mascot{margin:0;width:min(320px,76vw)}'''
component += breathing_css + '</style></head><body><figure class="hero-mascot"></figure><script>const mascot='
component += json.dumps(mascot) + ';\n' + portrait_function
component += '\ndocument.querySelector(\'.hero-mascot\').innerHTML=breathingMascot();</script></body></html>'
component_target = root.parent / '栖栖-呼吸效果.html'
component_target.write_text(component)
print(f'{component_target} ({component_target.stat().st_size:,} bytes)')
