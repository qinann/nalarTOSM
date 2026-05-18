import type { SistemData, SistemComponentDetail } from '../types.js';
import type { ModuleMeta } from '../types.js';

let activeComp: string | null = null;

export function render(data: SistemData, container: HTMLElement): void {
  renderOverview(data, container);

  const app = container.closest<HTMLElement>('#app')!;


  app.addEventListener('click', e => {
    if (!container.classList.contains('active')) return;

    // Sub-component click from left panel — show inline
    const subEl = (e.target as HTMLElement).closest<HTMLElement>('[data-subcomp]');
    if (subEl && activeComp) {
      const subName = subEl.dataset['subcomp']!;
      const detail = data.componentDetails?.[activeComp];
      const sub = detail?.subComponentDetails?.[subName];
      if (!sub) return;

      // Highlight active sub-comp in left panel sub-list
      app.querySelectorAll<HTMLElement>('.sub-comp-list-left [data-subcomp]').forEach(el =>
        el.classList.toggle('active', el.dataset['subcomp'] === subName)
      );

      // Show sub-component media in main panel
      container.innerHTML = mediaBlock(sub.imageUrl, sub.caption);

      // Update right panel with fungsi
      const right = app.querySelector<HTMLElement>('[data-right="sistem"]');
      if (right) {
        right.innerHTML = `
          <div class="right-section">
            <h4>Fungsi Komponen</h4>
            ${renderFungsi(sub.fungsi)}
          </div>`;
      }
      return;
    }

    // Main component click — switch left panel to sub-component list
    const item = (e.target as HTMLElement).closest<HTMLElement>('.comp-item[data-comp]');
    if (!item) return;

    const name = item.dataset['comp']!;
    if (!data.componentDetails?.[name]) return;

    activeComp = name;
    const detail = data.componentDetails[name];
    renderDetail(detail, container);
    updateRight(app, detail);
    updateLeftToSubComps(app, name, detail.subComponents);
  });
}

export function renderSubComp(
  meta: ModuleMeta,
  data: SistemData,
  compName: string,
  subName: string,
  container: HTMLElement
): void {
  const detail = data.componentDetails?.[compName];
  const sub = detail?.subComponentDetails?.[subName];

  document.title = `TOSM — ${subName}`;

  container.innerHTML = `
<div class="layout">
  <aside class="left-panel">
    <a href="dashboard.html" class="logo">
      <div class="logo-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17"           stroke="white" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12"           stroke="white" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="logo-text">TOSM</span>
    </a>
    <div class="left-view active">
      <div class="module-title-side">
        <span class="module-id-side">${esc(meta.id)}</span>
        ${esc(meta.title)}
      </div>
      <div class="left-section-label">List Sub-Komponen</div>
      <ul class="comp-list">
        ${(detail?.subComponents ?? []).map(sc => `
          <li class="comp-item${sc === subName ? ' active' : ''}" data-subcomp="${escA(sc)}">${esc(sc)}</li>
        `).join('')}
      </ul>
    </div>
    <button class="btn-back" id="btn-back">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Kembali
    </button>
  </aside>

  <main class="main-content">
    <div class="tab-bar">
      <a href="modul-detail.html?id=${escA(meta.id)}&tab=capaian"  class="tab-btn">Capaian</a>
      <a href="modul-detail.html?id=${escA(meta.id)}&tab=sistem"   class="tab-btn active">Sistem Kerja</a>
      <a href="modul-detail.html?id=${escA(meta.id)}&tab=praktek"  class="tab-btn">Praktek Kerja</a>
      <a href="modul-detail.html?id=${escA(meta.id)}&tab=evaluasi" class="tab-btn">Evaluasi Kerja</a>
    </div>
    <div class="subcomp-breadcrumb">
      <a href="modul-detail.html?id=${escA(meta.id)}&tab=sistem" class="breadcrumb-link">${esc(meta.title)}</a>
      <span class="breadcrumb-sep">›</span>
      <a href="modul-detail.html?id=${escA(meta.id)}&tab=sistem" class="breadcrumb-link">${esc(compName)}</a>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-current">${esc(subName)}</span>
    </div>
    <div class="tab-panel active" style="padding:20px">
      ${mediaBlock(sub?.imageUrl, sub?.caption ?? subName)}
    </div>
  </main>

  <aside class="right-panel">
    <div class="right-section">
      <h4>Fungsi Komponen</h4>
      ${renderFungsi(sub?.fungsi ?? '')}
    </div>
  </aside>
</div>`;

  container.querySelector('#btn-back')?.addEventListener('click', () => history.back());

  // Clicking another sub-component in the left list navigates to it
  container.addEventListener('click', e => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-subcomp]');
    if (!li) return;
    const sc = li.dataset['subcomp']!;
    if (sc === subName) return;
    const id = new URLSearchParams(location.search).get('id') || 'TOSM-001';
    location.href = `modul-detail.html?id=${encodeURIComponent(id)}&comp=${encodeURIComponent(compName)}&sub=${encodeURIComponent(sc)}`;
  });
}

function renderOverview(data: SistemData, container: HTMLElement): void {
  const html = mediaBlock(data.imageUrl, data.caption);
  container.innerHTML = html;
  container.dataset['overview'] = html;
}

function renderDetail(detail: SistemComponentDetail, container: HTMLElement): void {
  container.innerHTML = mediaBlock(detail.imageUrl, detail.caption);
}

function updateLeftToSubComps(app: HTMLElement, compName: string, subComponents: string[]): void {
  const left = app.querySelector<HTMLElement>('[data-left="komponen"]');
  if (!left) return;

  // Collapse main list to only the selected component
  const mainList = left.querySelector<HTMLElement>('.comp-list');
  if (mainList) {
    mainList.innerHTML = `
      <li class="comp-item active" data-comp="${escA(compName)}">${esc(compName)}</li>`;
  }

  // Populate and show sub-section
  const section = left.querySelector<HTMLElement>('.sub-left-section');
  const label   = left.querySelector<HTMLElement>('.sub-left-label');
  const list    = left.querySelector<HTMLElement>('.sub-comp-list-left');
  if (label) label.textContent = compName;
  if (list) {
    list.innerHTML = subComponents.map(sc => `
      <li class="comp-item" data-subcomp="${escA(sc)}">${esc(sc)}</li>
    `).join('');
  }
  if (section) section.style.display = '';
}

function mediaBlock(url: string | null | undefined, caption: string): string {
  if (!url) {
    return `<div class="diagram-box">
      <div class="diagram-placeholder">
        ${placeholderSvg()}
        <div class="diagram-caption">${esc(caption)}</div>
      </div>
    </div>`;
  }
  const is3D = /\.(glb|gltf)$/i.test(url);
  const media = is3D
    ? `<model-viewer src="${esc(url)}" auto-rotate camera-controls shadow-intensity="1" exposure="0.8"></model-viewer>`
    : `<img src="${esc(url)}" alt="${esc(caption)}"/>`;
  return `<div class="diagram-box">${media}</div>
          <p class="diagram-caption">${esc(caption)}</p>`;
}

function updateRight(app: HTMLElement, detail: SistemComponentDetail): void {
  const right = app.querySelector<HTMLElement>('[data-right="sistem"]');
  if (!right) return;
  right.innerHTML = `
    <div class="right-section">
      <h4>Fungsi Komponen</h4>
      ${renderFungsi(detail.fungsi)}
    </div>`;
}

function renderFungsi(text: string): string {
  return text.split(/\n\n+/).map(p => `<p>${esc(p.trim())}</p>`).join('');
}

function placeholderSvg(): string {
  return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escA(s: string): string { return s.replace(/"/g, '&quot;'); }
