// PDFViewer.js
// Drop-in PDF.js overlay viewer with a top gray bar + Back button.
// Attaches to window.PDFViewer = { open, close, isOpen }

(function(){
  let _state = {
    overlay: null,
    viewerHost: null,
    loaded: false,
    pdfjsLib: null,
    pdfjsViewer: null,
    pdfDoc: null,
    eventBus: null,
    pdfViewer: null,
    linkService: null,
    findController: null,
    scaleSelect: null,
    pageNumber: null,
    numPages: null,
    onBack: null
  };

  function _css(){
    return `
    .cv-pdf-overlay{
      position:fixed;
      inset:0;
      z-index:999999;
      display:flex;
      flex-direction:column;
      background:#1f2937;
    }
    .cv-pdf-topbar{
      height:52px;
      min-height:52px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 12px;
      background:#2b2f36;
      color:#ffffff;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      user-select:none;
    }
    .cv-pdf-left, .cv-pdf-right{
      display:flex;
      align-items:center;
      gap:10px;
    }
    .cv-pdf-btn{
      appearance:none;
      border:0;
      cursor:pointer;
      height:36px;
      padding:0 12px;
      border-radius:10px;
      background:#111827;
      color:#ffffff;
      font-weight:800;
      font-size:13px;
      letter-spacing:.2px;
      display:inline-flex;
      align-items:center;
      gap:8px;
      box-shadow:0 8px 18px rgba(0,0,0,.25);
    }
    .cv-pdf-btn:hover{ filter:brightness(1.08); }
    .cv-pdf-btn:active{ transform:translateY(1px); }
    .cv-pdf-chip{
      height:36px;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:0 10px;
      border-radius:10px;
      background:#111827;
      color:#ffffff;
      font-weight:850;
      font-size:13px;
    }
    .cv-pdf-input{
      width:64px;
      height:30px;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.18);
      background:#0b1220;
      color:#fff;
      outline:none;
      padding:0 8px;
      font-weight:850;
      font-size:13px;
      text-align:center;
    }
    .cv-pdf-select{
      height:30px;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.18);
      background:#0b1220;
      color:#fff;
      outline:none;
      padding:0 8px;
      font-weight:850;
      font-size:13px;
    }
    .cv-pdf-main{
      flex:1 1 auto;
      overflow:auto;
      background:#374151;
    }
    .cv-pdf-viewerWrap{
      min-height:100%;
      display:flex;
      justify-content:center;
      padding:16px 0 40px;
    }

    .pdfViewer{
      position:relative;
    }
    .pdfViewer .page{
      margin:0 0 12px 0;
      border-radius:8px;
      overflow:hidden;
      box-shadow:0 12px 26px rgba(0,0,0,.28);
      background:#fff;
    }
    .pdfViewer .textLayer{
      position:absolute;
      inset:0;
      overflow:hidden;
      opacity:1;
      line-height:1;
      text-size-adjust:none;
      forced-color-adjust:none;
      transform-origin:0 0;
      z-index:2;
    }
    .pdfViewer .textLayer span{
      position:absolute;
      white-space:pre;
      cursor:text;
      transform-origin:0 0;
    }
    .pdfViewer .canvasWrapper{
      position:relative;
      z-index:1;
    }
    `;
  }

  function _injectStyle(){
    const id = "cv_pdfviewer_style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = _css();
    document.head.appendChild(style);
  }

  async function _loadPdfJs(){
    if (_state.loaded) return;

    const pdfJsUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
    const pdfViewerUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf_viewer.min.mjs";
    const workerUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

    const [pdfjsLib, pdfjsViewer] = await Promise.all([
      import(pdfJsUrl),
      import(pdfViewerUrl)
    ]);

    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

    _state.pdfjsLib = pdfjsLib;
    _state.pdfjsViewer = pdfjsViewer;
    _state.loaded = true;
  }

  function _buildOverlay(){
    if (_state.overlay) return;

    _injectStyle();

    const overlay = document.createElement("div");
    overlay.className = "cv-pdf-overlay";
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");

    const topbar = document.createElement("div");
    topbar.className = "cv-pdf-topbar";

    const left = document.createElement("div");
    left.className = "cv-pdf-left";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "cv-pdf-btn";
    backBtn.innerHTML = "&#8592;&nbsp;Back";
    backBtn.addEventListener("click", function(){ close(); });

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "cv-pdf-btn";
    prevBtn.textContent = "Prev";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "cv-pdf-btn";
    nextBtn.textContent = "Next";

    const pageChip = document.createElement("div");
    pageChip.className = "cv-pdf-chip";
    pageChip.innerHTML = `Page <input class="cv-pdf-input" inputmode="numeric" id="cv_pdf_pageno" value="1"> <span id="cv_pdf_pagecount">/ 0</span>`;

    const zoomSelect = document.createElement("select");
    zoomSelect.className = "cv-pdf-select";
    zoomSelect.id = "cv_pdf_zoom";
    [
      {v:"0.5", t:"50%"},
      {v:"0.75", t:"75%"},
      {v:"1", t:"100%"},
      {v:"1.25", t:"125%"},
      {v:"1.5", t:"150%"},
      {v:"2", t:"200%"},
      {v:"page-width", t:"Page Width"},
      {v:"page-fit", t:"Page Fit"}
    ].forEach(function(o){
      const opt = document.createElement("option");
      opt.value = o.v;
      opt.textContent = o.t;
      zoomSelect.appendChild(opt);
    });

    const spacer = document.createElement("div");
    spacer.style.flex = "1 1 auto";

    const right = document.createElement("div");
    right.className = "cv-pdf-right";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "cv-pdf-btn";
    downloadBtn.textContent = "Download";

    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "cv-pdf-btn";
    printBtn.textContent = "Print";

    left.appendChild(backBtn);
    left.appendChild(prevBtn);
    left.appendChild(nextBtn);
    left.appendChild(pageChip);
    left.appendChild(zoomSelect);

    right.appendChild(downloadBtn);
    right.appendChild(printBtn);

    topbar.appendChild(left);
    topbar.appendChild(spacer);
    topbar.appendChild(right);

    const main = document.createElement("div");
    main.className = "cv-pdf-main";

    const viewerWrap = document.createElement("div");
    viewerWrap.className = "cv-pdf-viewerWrap";

    const viewerHost = document.createElement("div");
    viewerHost.className = "pdfViewer";
    viewerHost.id = "cv_pdf_viewer";

    viewerWrap.appendChild(viewerHost);
    main.appendChild(viewerWrap);

    overlay.appendChild(topbar);
    overlay.appendChild(main);

    document.body.appendChild(overlay);

    _state.overlay = overlay;
    _state.viewerHost = viewerHost;
    _state.scaleSelect = zoomSelect;
    _state.pageNumber = overlay.querySelector("#cv_pdf_pageno");
    _state.numPages = overlay.querySelector("#cv_pdf_pagecount");

    downloadBtn.addEventListener("click", function(){
      if (!_state.pdfDoc) return;
      _state.pdfDoc.getData().then(function(data){
        const blob = new Blob([data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "document.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
      });
    });

    printBtn.addEventListener("click", async function(){
      if (!_state.pdfDoc) return;
      const data = await _state.pdfDoc.getData();
      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;

      document.body.appendChild(iframe);
      iframe.onload = function(){
        try{ iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch {}
        setTimeout(function(){
          iframe.remove();
          URL.revokeObjectURL(url);
        }, 2000);
      };
    });

    prevBtn.addEventListener("click", function(){
      if (!_state.pdfViewer) return;
      const cur = _state.pdfViewer.currentPageNumber || 1;
      _state.pdfViewer.currentPageNumber = Math.max(1, cur - 1);
      _syncPageUi();
    });

    nextBtn.addEventListener("click", function(){
      if (!_state.pdfViewer) return;
      const cur = _state.pdfViewer.currentPageNumber || 1;
      const max = _state.pdfViewer.pagesCount || 1;
      _state.pdfViewer.currentPageNumber = Math.min(max, cur + 1);
      _syncPageUi();
    });

    _state.pageNumber.addEventListener("change", function(){
      if (!_state.pdfViewer) return;
      const n = parseInt((_state.pageNumber.value || "1"), 10);
      if (!Number.isFinite(n)) return;
      const max = _state.pdfViewer.pagesCount || 1;
      _state.pdfViewer.currentPageNumber = Math.min(max, Math.max(1, n));
      _syncPageUi();
    });

    _state.scaleSelect.addEventListener("change", function(){
      if (!_state.pdfViewer) return;
      const v = _state.scaleSelect.value;
      if (v === "page-width" || v === "page-fit"){
        _state.pdfViewer.currentScaleValue = v;
      } else {
        const f = parseFloat(v);
        if (Number.isFinite(f)) _state.pdfViewer.currentScale = f;
      }
    });

    overlay.addEventListener("keydown", function(e){
      if (e.key === "Escape") close();
    });
  }

  function _destroyViewer(){
    try{
      if (_state.pdfDoc) _state.pdfDoc.destroy();
    } catch {}
    _state.pdfDoc = null;
    _state.eventBus = null;
    _state.pdfViewer = null;
    _state.linkService = null;
    _state.findController = null;

    if (_state.viewerHost){
      _state.viewerHost.innerHTML = "";
    }
  }

  function _syncPageUi(){
    if (!_state.pdfViewer) return;
    const cur = _state.pdfViewer.currentPageNumber || 1;
    const max = _state.pdfViewer.pagesCount || 0;
    if (_state.pageNumber) _state.pageNumber.value = String(cur);
    if (_state.numPages) _state.numPages.textContent = "/ " + String(max);
  }

  function _asDocumentArg(pdfUrlOrBytes){
    if (typeof pdfUrlOrBytes === "string"){
      return pdfUrlOrBytes;
    }
    if (pdfUrlOrBytes instanceof Uint8Array){
      return { data: pdfUrlOrBytes };
    }
    if (pdfUrlOrBytes instanceof ArrayBuffer){
      return { data: new Uint8Array(pdfUrlOrBytes) };
    }
    if (pdfUrlOrBytes && pdfUrlOrBytes.buffer && pdfUrlOrBytes.byteLength){
      try{
        return { data: new Uint8Array(pdfUrlOrBytes) };
      } catch {}
    }
    return pdfUrlOrBytes;
  }

  async function open(pdfUrlOrBytes, opts){
    opts = opts || {};
    await _loadPdfJs();
    _buildOverlay();

    _destroyViewer();

    _state.onBack = (typeof opts.onBack === "function") ? opts.onBack : null;

    _state.overlay.tabIndex = -1;
    _state.overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    try{ _state.overlay.focus(); } catch {}

    const v = _state.pdfjsViewer;
    const EventBus = v.EventBus;
    const PDFViewer = v.PDFViewer;
    const PDFLinkService = v.PDFLinkService;
    const PDFFindController = v.PDFFindController;

    _state.eventBus = new EventBus();

    _state.linkService = new PDFLinkService({ eventBus: _state.eventBus });

    _state.findController = new PDFFindController({
      eventBus: _state.eventBus,
      linkService: _state.linkService
    });

    const main = _state.overlay.querySelector(".cv-pdf-main");

    _state.pdfViewer = new PDFViewer({
      container: main,
      viewer: _state.viewerHost,
      eventBus: _state.eventBus,
      linkService: _state.linkService,
      findController: _state.findController,
      textLayerMode: 1,
      removePageBorders: false
    });

    _state.linkService.setViewer(_state.pdfViewer);

    _state.eventBus.on("pagesinit", function(){
      _state.pdfViewer.currentScaleValue = "page-width";
      _syncPageUi();
    });

    _state.eventBus.on("pagechanging", function(){
      _syncPageUi();
    });

    const loadingTask = _state.pdfjsLib.getDocument(_asDocumentArg(pdfUrlOrBytes));
    _state.pdfDoc = await loadingTask.promise;

    _state.pdfViewer.setDocument(_state.pdfDoc);
    _state.linkService.setDocument(_state.pdfDoc, null);

    _syncPageUi();
  }

  function close(){
    if (_state.onBack){
      try{ _state.onBack(); } catch {}
    }
    if (_state.overlay){
      _state.overlay.style.display = "none";
    }
    document.body.style.overflow = "";
    _destroyViewer();
  }

  function isOpen(){
    return !!(_state.overlay && _state.overlay.style.display !== "none");
  }

  window.PDFViewer = {
    open: open,
    close: close,
    isOpen: isOpen
  };
})();
