import type { ModuleMeta } from '../types.js';

export function renderShell(meta: ModuleMeta, praktekSteps: string[], container: HTMLElement): void {
  document.title = `TOSM — ${meta.title}`;
  container.innerHTML = buildShell(meta, praktekSteps);
  setupShellEvents(container);
}

function buildShell(meta: ModuleMeta, praktekSteps: string[]): string {
  return `
<div class="layout">

  <!-- LEFT PANEL -->
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

    <!-- Capaian: only ID + title -->
    <div data-left="capaian" class="left-view active">
      <div class="module-title-side">
        <span class="module-id-side">${esc(meta.id)}</span>
        ${esc(meta.title)}
      </div>
    </div>

    <!-- Sistem / Praktek / Evaluasi: component list -->
    <div data-left="komponen" class="left-view">
      <div class="module-title-side">
        <span class="module-id-side">${esc(meta.id)}</span>
        ${esc(meta.title)}
      </div>
      <div class="left-section-label">List Komponen</div>
      <ul class="comp-list">
        ${meta.components.map(c => `
          <li class="comp-item" data-comp="${escA(c)}">${esc(c)}</li>
        `).join('')}
      </ul>
      <div class="sub-left-section" style="display:none">
        <div class="left-section-label sub-left-label"></div>
        <ul class="comp-list sub-comp-list-left"></ul>
      </div>
    </div>

    <button class="btn-back" id="btn-back">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Kembali
    </button>
  </aside>

  <!-- MAIN CONTENT -->
  <main class="main-content">
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="capaian">Capaian</button>
      <button class="tab-btn"        data-tab="sistem">Sistem Kerja</button>
      <button class="tab-btn"        data-tab="praktek">Praktek Kerja</button>
      <button class="tab-btn"        data-tab="evaluasi">Evaluasi Kerja</button>
    </div>

    <div class="tab-panel active" data-panel="capaian"></div>
    <div class="tab-panel"        data-panel="sistem"></div>
    <div class="tab-panel"        data-panel="praktek"></div>
    <div class="tab-panel"        data-panel="evaluasi"></div>

  </main>

  <!-- RIGHT PANEL -->
  <aside class="right-panel">

    <div data-right="capaian" class="right-view active">
      <div class="right-section">
        <h4>Deskripsi Modul</h4>
        <p>${esc(meta.desc)}</p>
      </div>
      <div class="right-section">
        <h4>Info Modul</h4>
        <div class="info-row">
          <span class="info-key">ID</span>
          <span class="info-val">${esc(meta.id)}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Level</span>
          <span class="info-val">${esc(meta.level.charAt(0).toUpperCase() + meta.level.slice(1))}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Komponen</span>
          <span class="info-val">${meta.components.length} komponen</span>
        </div>
      </div>
      <div class="right-section">
        <h4>Kompetensi Dasar</h4>
        <p style="font-size:12px;color:var(--muted);line-height:1.7;">${esc(meta.kd)}</p>
      </div>
    </div>

    <div data-right="sistem" class="right-view">
      <div class="right-section">
        <h4>Deskripsi Sistem Kerja</h4>
        ${renderSistemDesc(meta.sistemDesc ?? meta.desc)}
      </div>
    </div>

    <div data-right="praktek" class="right-view">
      <div class="right-section">
        <h4>Checklist Praktik</h4>
        <ul class="todo-list">
          ${praktekSteps.map((title, i) => `
            <li class="todo-item" data-todo="${i}">
              <div class="todo-check">
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <polyline points="1 3.5 3.5 6 8 1" stroke="white" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span>${esc(title)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>

    <div data-right="evaluasi" class="right-view"></div>

  </aside>

</div>`;
}

function setupShellEvents(root: HTMLElement): void {
  root.querySelector('#btn-back')?.addEventListener('click', () => history.back());

  // Save originals after first paint so sistem.ts can restore them on tab switch
  requestAnimationFrame(() => {
    root.querySelectorAll<HTMLElement>('.right-view').forEach(rv => {
      rv.dataset['original'] = rv.innerHTML;
    });
    const leftKomponen = root.querySelector<HTMLElement>('[data-left="komponen"]');
    if (leftKomponen) leftKomponen.dataset['original'] = leftKomponen.innerHTML;
  });

  // Tab switching — main panel + left view + right view + hide-right for evaluasi
  root.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.tab-btn');
    if (!btn) return;
    const tab = btn.dataset['tab']!;

    // Restore right-views and left komponen panel to originals
    root.querySelectorAll<HTMLElement>('.right-view').forEach(rv => {
      if (rv.dataset['original']) rv.innerHTML = rv.dataset['original'];
    });
    const leftKomponen = root.querySelector<HTMLElement>('[data-left="komponen"]');
    if (leftKomponen?.dataset['original']) leftKomponen.innerHTML = leftKomponen.dataset['original'];

    // Restore sistem panel overview when switching to sistem tab
    if (tab === 'sistem') {
      const p = root.querySelector<HTMLElement>('[data-panel="sistem"]');
      if (p?.dataset['overview']) p.innerHTML = p.dataset['overview'];
    }

    root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    root.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    root.querySelectorAll<HTMLElement>('.right-view').forEach(v => v.classList.remove('active'));
    root.querySelectorAll<HTMLElement>('.left-view').forEach(v => v.classList.remove('active'));
    root.querySelectorAll<HTMLElement>('.comp-item').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    root.querySelector<HTMLElement>(`[data-panel="${tab}"]`)?.classList.add('active');
    root.querySelector<HTMLElement>(`[data-right="${tab}"]`)?.classList.add('active');
    const leftKey = tab === 'sistem' ? 'komponen' : 'capaian';
    root.querySelector<HTMLElement>(`[data-left="${leftKey}"]`)?.classList.add('active');
    root.querySelector<HTMLElement>('.layout')?.classList.toggle('hide-right', tab === 'evaluasi');
  });

  // Todo checklist toggle
  root.addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.todo-item');
    if (!item) return;
    item.classList.toggle('done');
  });

}

function renderSistemDesc(text: string): string {
  const chunks = text.split(/\n\n+/).map(c => c.trim()).filter(Boolean);
  return chunks.map(chunk => {
    const m = chunk.match(/^(\d+)\.\s+([^:]+):\s*([\s\S]+)$/);
    if (m) {
      return `<div class="sistem-step">
        <div class="sistem-step-num">${esc(m[1])}</div>
        <div class="sistem-step-body">
          <span class="sistem-step-label">${esc(m[2])}</span>
          <span class="sistem-step-desc">${esc(m[3])}</span>
        </div>
      </div>`;
    }
    return `<p>${esc(chunk)}</p>`;
  }).join('');
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escA(s: string): string { return s.replace(/"/g,'&quot;'); }
