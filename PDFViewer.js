/**
 * PDFViewer.js - Enhanced PDF Viewer with Overlay Interface
 * A drop-in PDF.js overlay viewer with navigation controls and back button
 * 
 * Usage:
 *   PDFViewer.open(pdfUrlOrBytes, options)
 *   PDFViewer.close()
 *   PDFViewer.isOpen()
 */

(function() {
  'use strict';

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const state = {
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
    pageNumberInput: null,
    pageCountSpan: null,
    onBack: null,
    currentPdfUrl: null,
    currentPdfFilename: 'document.pdf'
  };

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  
  const CONSTANTS = {
    PDFJS_VERSION: '4.10.38',
    PDFJS_CDN: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js',
    ZOOM_LEVELS: [
      { value: '0.5', label: '50%' },
      { value: '0.75', label: '75%' },
      { value: '1', label: '100%' },
      { value: '1.25', label: '125%' },
      { value: '1.5', label: '150%' },
      { value: '2', label: '200%' },
      { value: 'page-width', label: 'Page Width' },
      { value: 'page-fit', label: 'Page Fit' }
    ],
    DEFAULT_SCALE: 'page-width'
  };

  // ============================================================================
  // STYLES
  // ============================================================================
  
  function getStyles() {
    return `
      /* Overlay Container */
      .cv-pdf-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        background: #1f2937;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      }

      /* Top Navigation Bar */
      .cv-pdf-topbar {
        height: 52px;
        min-height: 52px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        background: #2b2f36;
        color: #ffffff;
        user-select: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .cv-pdf-left,
      .cv-pdf-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      /* Buttons */
      .cv-pdf-btn {
        appearance: none;
        border: 0;
        cursor: pointer;
        height: 36px;
        padding: 0 16px;
        border-radius: 10px;
        background: #111827;
        color: #ffffff;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: 0.3px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        transition: all 0.15s ease;
        white-space: nowrap;
      }

      .cv-pdf-btn:hover {
        background: #1f2937;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
      }

      .cv-pdf-btn:active {
        transform: translateY(1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .cv-pdf-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .cv-pdf-btn-back {
        background: #3b82f6;
        font-weight: 700;
      }

      .cv-pdf-btn-back:hover {
        background: #2563eb;
      }

      /* Page Navigation Chip */
      .cv-pdf-chip {
        height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0 12px;
        border-radius: 10px;
        background: #111827;
        color: #ffffff;
        font-weight: 600;
        font-size: 14px;
      }

      /* Input Fields */
      .cv-pdf-input {
        width: 64px;
        height: 30px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: #0b1220;
        color: #fff;
        outline: none;
        padding: 0 8px;
        font-weight: 600;
        font-size: 14px;
        text-align: center;
        transition: border-color 0.2s ease;
      }

      .cv-pdf-input:focus {
        border-color: #3b82f6;
      }

      /* Select Dropdown */
      .cv-pdf-select {
        height: 30px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: #0b1220;
        color: #fff;
        outline: none;
        padding: 0 8px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: border-color 0.2s ease;
      }

      .cv-pdf-select:focus {
        border-color: #3b82f6;
      }

      /* Main Content Area */
      .cv-pdf-main {
        flex: 1 1 auto;
        overflow: auto;
        background: #374151;
      }

      .cv-pdf-viewerWrap {
        min-height: 100%;
        display: flex;
        justify-content: center;
        padding: 20px 16px 60px;
      }

      /* Loading Indicator */
      .cv-pdf-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        color: #ffffff;
        font-size: 16px;
        font-weight: 600;
      }

      .cv-pdf-spinner {
        display: inline-block;
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.2);
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: cv-pdf-spin 0.8s linear infinite;
        margin-right: 16px;
      }

      @keyframes cv-pdf-spin {
        to { transform: rotate(360deg); }
      }

      /* Error Message */
      .cv-pdf-error {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        color: #ef4444;
        font-size: 16px;
        font-weight: 600;
        padding: 20px;
        text-align: center;
      }

      /* PDF Viewer Styles */
      .pdfViewer {
        position: relative;
      }

      .pdfViewer .page {
        margin: 0 0 16px 0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        background: #fff;
        position: relative;
      }

      .pdfViewer .textLayer {
        position: absolute;
        inset: 0;
        overflow: hidden;
        opacity: 1;
        line-height: 1;
        text-size-adjust: none;
        forced-color-adjust: none;
        transform-origin: 0 0;
        z-index: 2;
      }

      .pdfViewer .textLayer span {
        position: absolute;
        white-space: pre;
        cursor: text;
        transform-origin: 0 0;
      }

      .pdfViewer .canvasWrapper {
        position: relative;
        z-index: 1;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .cv-pdf-topbar {
          padding: 0 8px;
        }

        .cv-pdf-left,
        .cv-pdf-right {
          gap: 8px;
        }

        .cv-pdf-btn {
          padding: 0 12px;
          font-size: 13px;
        }

        .cv-pdf-chip {
          font-size: 13px;
        }
      }
    `;
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function injectStyles() {
    const styleId = 'cv_pdfviewer_style';
    if (document.getElementById(styleId)) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = getStyles();
    document.head.appendChild(styleEl);
  }

  function extractFilenameFromUrl(url) {
    if (typeof url !== 'string') return 'document.pdf';
    
    try {
      const urlObj = new URL(url, window.location.href);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      const filename = parts[parts.length - 1];
      
      if (filename && filename.endsWith('.pdf')) {
        return decodeURIComponent(filename);
      }
    } catch (e) {
      // Invalid URL, continue to default
    }
    
    return 'document.pdf';
  }

  function convertToDocumentArg(pdfUrlOrBytes) {
    if (typeof pdfUrlOrBytes === 'string') {
      return pdfUrlOrBytes;
    }
    
    if (pdfUrlOrBytes instanceof Uint8Array) {
      return { data: pdfUrlOrBytes };
    }
    
    if (pdfUrlOrBytes instanceof ArrayBuffer) {
      return { data: new Uint8Array(pdfUrlOrBytes) };
    }
    
    if (pdfUrlOrBytes?.buffer && pdfUrlOrBytes.byteLength !== undefined) {
      try {
        return { data: new Uint8Array(pdfUrlOrBytes) };
      } catch (e) {
        console.error('Failed to convert to Uint8Array:', e);
      }
    }
    
    return pdfUrlOrBytes;
  }

  // ============================================================================
  // PDF.JS LOADING
  // ============================================================================

  async function loadPdfJs() {
    if (state.loaded) return;

    const baseUrl = `${CONSTANTS.PDFJS_CDN}/${CONSTANTS.PDFJS_VERSION}`;
    const pdfJsUrl = `${baseUrl}/pdf.min.mjs`;
    const pdfViewerUrl = `${baseUrl}/pdf_viewer.min.mjs`;
    const workerUrl = `${baseUrl}/pdf.worker.min.mjs`;

    try {
      const [pdfjsLib, pdfjsViewer] = await Promise.all([
        import(pdfJsUrl),
        import(pdfViewerUrl)
      ]);

      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

      state.pdfjsLib = pdfjsLib;
      state.pdfjsViewer = pdfjsViewer;
      state.loaded = true;
    } catch (error) {
      console.error('Failed to load PDF.js libraries:', error);
      throw new Error('Failed to load PDF viewer libraries');
    }
  }

  // ============================================================================
  // UI BUILDING
  // ============================================================================

  function createButton(text, className = 'cv-pdf-btn', onClick = null) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = text;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  function createBackButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cv-pdf-btn cv-pdf-btn-back';
    btn.innerHTML = '&#8592;&nbsp;Back';
    btn.setAttribute('aria-label', 'Go back');
    btn.addEventListener('click', handleClose);
    return btn;
  }

  function createNavigationButtons() {
    const prevBtn = createButton('Prev', 'cv-pdf-btn', handlePrevPage);
    const nextBtn = createButton('Next', 'cv-pdf-btn', handleNextPage);
    return { prevBtn, nextBtn };
  }

  function createPageNavigator() {
    const chip = document.createElement('div');
    chip.className = 'cv-pdf-chip';
    chip.setAttribute('role', 'status');
    chip.setAttribute('aria-live', 'polite');
    
    const pageInput = document.createElement('input');
    pageInput.type = 'text';
    pageInput.inputMode = 'numeric';
    pageInput.className = 'cv-pdf-input';
    pageInput.id = 'cv_pdf_pageno';
    pageInput.value = '1';
    pageInput.setAttribute('aria-label', 'Page number');
    pageInput.addEventListener('change', handlePageChange);
    pageInput.addEventListener('keydown', handlePageInputKeydown);

    const pageCount = document.createElement('span');
    pageCount.id = 'cv_pdf_pagecount';
    pageCount.textContent = '/ 0';

    chip.appendChild(document.createTextNode('Page '));
    chip.appendChild(pageInput);
    chip.appendChild(document.createTextNode(' '));
    chip.appendChild(pageCount);

    state.pageNumberInput = pageInput;
    state.pageCountSpan = pageCount;

    return chip;
  }

  function createZoomSelect() {
    const select = document.createElement('select');
    select.className = 'cv-pdf-select';
    select.id = 'cv_pdf_zoom';
    select.setAttribute('aria-label', 'Zoom level');

    CONSTANTS.ZOOM_LEVELS.forEach(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });

    select.addEventListener('change', handleZoomChange);
    state.scaleSelect = select;

    return select;
  }

  function createActionButtons() {
    const downloadBtn = createButton('Download', 'cv-pdf-btn', handleDownload);
    downloadBtn.setAttribute('aria-label', 'Download PDF');
    
    const printBtn = createButton('Print', 'cv-pdf-btn', handlePrint);
    printBtn.setAttribute('aria-label', 'Print PDF');

    return { downloadBtn, printBtn };
  }

  function buildOverlay() {
    if (state.overlay) return;

    injectStyles();

    // Main overlay container
    const overlay = document.createElement('div');
    overlay.className = 'cv-pdf-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'PDF Viewer');
    overlay.addEventListener('keydown', handleKeydown);

    // Top bar
    const topbar = document.createElement('div');
    topbar.className = 'cv-pdf-topbar';

    // Left section
    const leftSection = document.createElement('div');
    leftSection.className = 'cv-pdf-left';

    const backBtn = createBackButton();
    const { prevBtn, nextBtn } = createNavigationButtons();
    const pageNav = createPageNavigator();
    const zoomSelect = createZoomSelect();

    leftSection.appendChild(backBtn);
    leftSection.appendChild(prevBtn);
    leftSection.appendChild(nextBtn);
    leftSection.appendChild(pageNav);
    leftSection.appendChild(zoomSelect);

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1 1 auto';

    // Right section
    const rightSection = document.createElement('div');
    rightSection.className = 'cv-pdf-right';

    const { downloadBtn, printBtn } = createActionButtons();
    rightSection.appendChild(downloadBtn);
    rightSection.appendChild(printBtn);

    topbar.appendChild(leftSection);
    topbar.appendChild(spacer);
    topbar.appendChild(rightSection);

    // Main content area
    const main = document.createElement('div');
    main.className = 'cv-pdf-main';

    const viewerWrap = document.createElement('div');
    viewerWrap.className = 'cv-pdf-viewerWrap';

    const viewerHost = document.createElement('div');
    viewerHost.className = 'pdfViewer';
    viewerHost.id = 'cv_pdf_viewer';

    viewerWrap.appendChild(viewerHost);
    main.appendChild(viewerWrap);

    overlay.appendChild(topbar);
    overlay.appendChild(main);

    document.body.appendChild(overlay);

    state.overlay = overlay;
    state.viewerHost = viewerHost;
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleClose() {
    close();
  }

  function handlePrevPage() {
    if (!state.pdfViewer) return;
    
    const currentPage = state.pdfViewer.currentPageNumber || 1;
    state.pdfViewer.currentPageNumber = Math.max(1, currentPage - 1);
    syncPageUI();
  }

  function handleNextPage() {
    if (!state.pdfViewer) return;
    
    const currentPage = state.pdfViewer.currentPageNumber || 1;
    const maxPage = state.pdfViewer.pagesCount || 1;
    state.pdfViewer.currentPageNumber = Math.min(maxPage, currentPage + 1);
    syncPageUI();
  }

  function handlePageChange() {
    if (!state.pdfViewer || !state.pageNumberInput) return;
    
    const pageNum = parseInt(state.pageNumberInput.value, 10);
    
    if (!Number.isFinite(pageNum) || pageNum < 1) {
      syncPageUI();
      return;
    }
    
    const maxPage = state.pdfViewer.pagesCount || 1;
    state.pdfViewer.currentPageNumber = Math.min(maxPage, Math.max(1, pageNum));
    syncPageUI();
  }

  function handlePageInputKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePageChange();
      e.target.blur();
    }
  }

  function handleZoomChange() {
    if (!state.pdfViewer || !state.scaleSelect) return;
    
    const value = state.scaleSelect.value;
    
    if (value === 'page-width' || value === 'page-fit') {
      state.pdfViewer.currentScaleValue = value;
    } else {
      const scale = parseFloat(value);
      if (Number.isFinite(scale)) {
        state.pdfViewer.currentScale = scale;
      }
    }
  }

  async function handleDownload() {
    if (!state.pdfDoc) return;
    
    try {
      const data = await state.pdfDoc.getData();
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = state.currentPdfFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download PDF');
    }
  }

  async function handlePrint() {
    if (!state.pdfDoc) return;
    
    try {
      const data = await state.pdfDoc.getData();
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      iframe.src = url;
      
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error('Print failed:', e);
        }
        
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 2000);
      };
    } catch (error) {
      console.error('Print failed:', error);
      alert('Failed to print PDF');
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowLeft' && !e.target.matches('input')) {
      handlePrevPage();
    } else if (e.key === 'ArrowRight' && !e.target.matches('input')) {
      handleNextPage();
    }
  }

  // ============================================================================
  // PDF VIEWER MANAGEMENT
  // ============================================================================

  function showLoading() {
    if (!state.viewerHost) return;
    
    state.viewerHost.innerHTML = `
      <div class="cv-pdf-loading">
        <div class="cv-pdf-spinner"></div>
        Loading PDF...
      </div>
    `;
  }

  function showError(message) {
    if (!state.viewerHost) return;
    
    state.viewerHost.innerHTML = `
      <div class="cv-pdf-error">
        ${message}
      </div>
    `;
  }

  function destroyViewer() {
    try {
      if (state.pdfDoc) {
        state.pdfDoc.destroy();
      }
    } catch (e) {
      console.error('Error destroying PDF document:', e);
    }

    state.pdfDoc = null;
    state.eventBus = null;
    state.pdfViewer = null;
    state.linkService = null;
    state.findController = null;

    if (state.viewerHost) {
      state.viewerHost.innerHTML = '';
    }
  }

  function syncPageUI() {
    if (!state.pdfViewer) return;
    
    const currentPage = state.pdfViewer.currentPageNumber || 1;
    const totalPages = state.pdfViewer.pagesCount || 0;
    
    if (state.pageNumberInput) {
      state.pageNumberInput.value = String(currentPage);
    }
    
    if (state.pageCountSpan) {
      state.pageCountSpan.textContent = `/ ${totalPages}`;
    }
  }

  async function initializeViewer(pdfUrlOrBytes) {
    const { EventBus, PDFViewer, PDFLinkService, PDFFindController } = state.pdfjsViewer;

    // Create event bus
    state.eventBus = new EventBus();

    // Create link service
    state.linkService = new PDFLinkService({
      eventBus: state.eventBus
    });

    // Create find controller
    state.findController = new PDFFindController({
      eventBus: state.eventBus,
      linkService: state.linkService
    });

    // Get container element
    const container = state.overlay.querySelector('.cv-pdf-main');

    // Create PDF viewer
    state.pdfViewer = new PDFViewer({
      container: container,
      viewer: state.viewerHost,
      eventBus: state.eventBus,
      linkService: state.linkService,
      findController: state.findController,
      textLayerMode: 1,
      removePageBorders: false
    });

    state.linkService.setViewer(state.pdfViewer);

    // Set up event listeners
    state.eventBus.on('pagesinit', () => {
      state.pdfViewer.currentScaleValue = CONSTANTS.DEFAULT_SCALE;
      syncPageUI();
    });

    state.eventBus.on('pagechanging', () => {
      syncPageUI();
    });

    // Load PDF document
    const loadingTask = state.pdfjsLib.getDocument(convertToDocumentArg(pdfUrlOrBytes));
    state.pdfDoc = await loadingTask.promise;

    // Set document
    state.pdfViewer.setDocument(state.pdfDoc);
    state.linkService.setDocument(state.pdfDoc, null);

    syncPageUI();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  async function open(pdfUrlOrBytes, options = {}) {
    try {
      // Load PDF.js libraries
      await loadPdfJs();

      // Build overlay UI
      buildOverlay();

      // Destroy any existing viewer
      destroyViewer();

      // Store callback and metadata
      state.onBack = typeof options.onBack === 'function' ? options.onBack : null;
      state.currentPdfUrl = typeof pdfUrlOrBytes === 'string' ? pdfUrlOrBytes : null;
      state.currentPdfFilename = options.filename || 
        (state.currentPdfUrl ? extractFilenameFromUrl(state.currentPdfUrl) : 'document.pdf');

      // Show overlay
      state.overlay.tabIndex = -1;
      state.overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // Show loading state
      showLoading();

      try {
        state.overlay.focus();
      } catch (e) {
        // Focus might fail in some contexts
      }

      // Initialize viewer and load PDF
      await initializeViewer(pdfUrlOrBytes);

    } catch (error) {
      console.error('Failed to open PDF:', error);
      showError('Failed to load PDF. Please try again.');
      throw error;
    }
  }

  function close() {
    // Call onBack callback if provided
    if (state.onBack) {
      try {
        state.onBack();
      } catch (e) {
        console.error('Error in onBack callback:', e);
      }
    }

    // Hide overlay
    if (state.overlay) {
      state.overlay.style.display = 'none';
    }

    // Restore page scroll
    document.body.style.overflow = '';

    // Clean up viewer
    destroyViewer();

    // Reset state
    state.onBack = null;
    state.currentPdfUrl = null;
    state.currentPdfFilename = 'document.pdf';
  }

  function isOpen() {
    return !!(state.overlay && state.overlay.style.display !== 'none');
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.PDFViewer = {
    open: open,
    close: close,
    isOpen: isOpen
  };

})();
