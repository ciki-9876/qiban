/* Shared by the product and the offline expedition preview. Text is never HTML. */
(function(root){
  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const layoutFor=f=>['quote','steps','flow','note'].includes(f.layout)?f.layout:(f.kind==='quote'?'quote':f.kind==='method'?'steps':f.kind==='design'?'flow':'note');
  function current(trip,id){return trip.findings?.find(f=>f.id===id)||trip.findings?.[0]||null;}
  function render(trip,id,{expanded=false,scope='home',savedIds=[]}={}){
    const f=current(trip,id);if(!f)return '';
    const layout=layoutFor(f);
    const titleId=expanded?'dialog-title':`${scope}-research-title`;
    const source=trip.sources[f.sourceIndexes[0]];
    const heading=`<h2 id="${esc(titleId)}" ${expanded?'tabindex="-1"':''}>${esc(f.headline)}</h2>`;
    return `<div class="research-deck" data-research-trip="${esc(trip.id)}" data-research-scope="${esc(scope)}">
      <div class="research-picks" style="--finding-count:${Math.min(trip.findings.length,3)}" role="group" aria-label="这次带回的 ${trip.findings.length} 份发现">${trip.findings.map((item,i)=>`<button type="button" data-research-pick="${esc(item.id)}" data-research-trip="${esc(trip.id)}" data-research-scope="${esc(scope)}" aria-pressed="${item.id===f.id}"><span class="research-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="research-pick-title">${esc(item.teaser)}${savedIds.includes(item.id)?'<span class="research-kept" aria-label="已收藏"> ✓</span>':''}</span></button>`).join('')}</div>
      <section class="research-panel research-layout-${layout}" aria-labelledby="${esc(titleId)}">
        ${layout==='quote'?`<span class="research-quote-mark" aria-hidden="true">“</span><blockquote>${heading}</blockquote>`:heading}
        <a class="research-credit" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(f.attribution)} ↗</a>
        ${f.context?`<p class="research-context">${esc(f.context)}</p>`:''}
        ${f.body?`<p class="research-body">${esc(f.body)}</p>`:''}
        ${f.points?.length?`<ul class="research-points">${f.points.map(point=>`<li>${esc(point)}</li>`).join('')}</ul>`:''}
        ${f.steps?.length?`<ol class="research-steps ${layout==='flow'?'research-flow':''}">${f.steps.map((step,i)=>`<li><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span><p>${esc(step)}</p></li>`).join('')}</ol>`:''}
        <div class="research-voice"><span>栖栖</span><p>${esc(f.voice)}</p></div>
        ${expanded?`${f.application?`<section class="research-application"><h3>${esc(f.application.title)}</h3><p>${esc(f.application.body)}</p>${f.application.lines?.length?`<ul>${f.application.lines.map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`:''}</section>`:''}
          <details class="research-sources"><summary>${f.original?'看看原文与出处':'看看出处'}</summary>${f.original?`<blockquote>${esc(f.original)}</blockquote>`:''}<p>${esc(f.evidenceNote)}</p>${f.sourceIndexes.map(i=>`<a href="${esc(trip.sources[i].url)}" target="_blank" rel="noopener noreferrer">${esc(trip.sources[i].title)} ↗</a>`).join('')}<small>查阅于 ${esc(f.checkedAt.slice(0,10))}</small></details>`:''}
      </section></div>`;
  }
  root.QibanResearch={current,render};
})(globalThis);
