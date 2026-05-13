import type { CapaianData } from '../types.js';

export function render(data: CapaianData, container: HTMLElement): void {
  container.innerHTML = `
<div class="cp-block">
  <div class="cp-section">
    <div class="cp-section-title">Capaian Pembelajaran (CP) Modul</div>
    <p class="cp-text">${esc(data.cp)}</p>
  </div>
  <div class="cp-section">
    <div class="cp-section-title">Tujuan Pembelajaran (TP)</div>
    <ol class="tp-list">
      ${data.tp.map(item => {
        const m = item.match(/^(\d+\.\d+)\s+(.+)$/);
        return m
          ? `<li class="tp-item"><span class="tp-code">${esc(m[1])}</span><span>${esc(m[2])}</span></li>`
          : `<li class="tp-item"><span>${esc(item)}</span></li>`;
      }).join('')}
    </ol>
  </div>
  <div class="cp-section">
    <div class="cp-section-title">Asesmen / Bukti Ketercapaian</div>
    <p class="cp-text">${esc(data.asesmen)}</p>
  </div>
</div>`;
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
