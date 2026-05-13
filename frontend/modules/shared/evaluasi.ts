import type { EvaluasiData } from '../types.js';

export function render(data: EvaluasiData, container: HTMLElement): void {
  container.innerHTML = `
<div class="quiz-list">
  ${data.questions.map((q, qi) => `
    <div class="quiz-item">
      <div class="quiz-q">${qi + 1}. ${esc(q.q)}</div>
      <div class="quiz-opts" data-correct="${q.ans}">
        ${q.opts.map((o, oi) => `
          <div class="quiz-opt" data-idx="${oi}">${String.fromCharCode(65 + oi)}. ${esc(o)}</div>
        `).join('')}
      </div>
    </div>
  `).join('')}
</div>`;

  // Event delegation — quiz answers
  container.addEventListener('click', e => {
    const opt = (e.target as HTMLElement).closest<HTMLElement>('.quiz-opt');
    if (!opt) return;
    const opts = opt.closest<HTMLElement>('.quiz-opts')!;
    if (opts.dataset['answered']) return;
    opts.dataset['answered'] = '1';
    const correct = Number(opts.dataset['correct']);
    const chosen  = Number(opt.dataset['idx']);
    opts.querySelectorAll<HTMLElement>('.quiz-opt').forEach(o => {
      o.style.pointerEvents = 'none';
      o.style.cursor        = 'default';
    });
    opts.querySelector<HTMLElement>(`[data-idx="${correct}"]`)?.classList.add('correct');
    if (chosen !== correct) opt.classList.add('wrong');
  });
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
