/* Native clipboard and file-drop input; shares the existing attachment uploader. */
(() => {
  function filesFromTransfer(transfer, imagesOnly=false) {
    const items=Array.from(transfer?.items||[]);
    let files=items.filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
    if(!files.length)files=Array.from(transfer?.files||[]);
    return imagesOnly?files.filter(file=>file.type.startsWith('image/')):files;
  }
  function bind(target,{canReceive,onFiles,onUnavailable=()=>{}}) {
    let depth=0;
    const clear=()=>{depth=0;target.classList.remove('attachment-dragging');};
    const isFileDrag=event=>Array.from(event.dataTransfer?.types||[]).includes('Files');
    target.addEventListener('paste',event=>{
      if(!canReceive())return;
      const images=filesFromTransfer(event.clipboardData,true);
      if(!images.length)return; // Ordinary text and URL paste retain native editing behavior.
      event.preventDefault();onFiles(images);
    });
    target.addEventListener('dragenter',event=>{
      if(!isFileDrag(event))return;
      event.preventDefault();
      if(canReceive()){depth++;target.classList.add('attachment-dragging');}
    });
    target.addEventListener('dragover',event=>{
      if(!isFileDrag(event))return;
      event.preventDefault();event.dataTransfer.dropEffect=canReceive()?'copy':'none';
    });
    target.addEventListener('dragleave',event=>{
      if(event.relatedTarget){if(target.contains(event.relatedTarget))return;clear();return;}
      depth=Math.max(0,depth-1);
      if(!event.relatedTarget||depth===0)clear();
    });
    target.addEventListener('drop',event=>{
      const files=filesFromTransfer(event.dataTransfer);
      clear();if(!files.length)return;
      event.preventDefault();
      if(canReceive())onFiles(files);else onUnavailable();
    });
    target.addEventListener('close',clear);
    target.addEventListener('dragend',clear);
    return {clear};
  }
  globalThis.QibanAttachmentInput={bind,filesFromTransfer};
})();
