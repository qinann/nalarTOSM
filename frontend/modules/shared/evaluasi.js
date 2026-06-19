const API = '/api';

export function render(data, container) {
    const params  = new URLSearchParams(location.search);
    const modulId = params.get('id') || 'TOSM-001';
    showGate(data, container, modulId);
}

async function showGate(data, container, modulId) {
    const token = localStorage.getItem('tosm_token');
    let kelasList = [], siswaList = [], sudahList = [];
    try {
        const [rk, rs, re] = await Promise.all([
            fetch(`${API}/kelas`,    { headers: { Authorization: 'Bearer ' + token } }),
            fetch(`${API}/siswa`,    { headers: { Authorization: 'Bearer ' + token } }),
            fetch(`${API}/evaluasi`, { headers: { Authorization: 'Bearer ' + token } })
        ]);
        kelasList  = rk.ok ? await rk.json() : [];
        siswaList  = rs.ok ? await rs.json() : [];
        const semua = re.ok ? await re.json() : [];
        sudahList  = new Set(semua.filter(r => r.modul_id === modulId).map(r => r.siswa_id));
    } catch { /* no-op */ }

    const noSiswa = siswaList.length === 0;

    function buildSiswaOptions(kelasId) {
        const filtered = kelasId
            ? siswaList.filter(s => String(s.kelas_id) === String(kelasId))
            : siswaList;
        if (filtered.length === 0) return `<option value="">— Tidak ada siswa —</option>`;
        return `<option value="">— Pilih Siswa —</option>` +
            filtered.map(s => {
                const sudah = sudahList.has(s.id);
                return `<option value="${s.id}" ${sudah ? 'disabled style="color:#888"' : ''}>${esc(s.nama)}${sudah ? ' (sudah mengerjakan)' : ''}</option>`;
            }).join('');
    }

    container.innerHTML = `
<div class="eval-gate">
  <div class="eval-gate-box">
    <div class="eval-gate-title">Evaluasi Kerja</div>
    <div class="eval-gate-meta">${data.questions.length} Soal</div>
    <div class="eval-field">
      <label>Pilih Kelas</label>
      <select id="eval-kelas-sel">
        <option value="">— Semua Kelas —</option>
        ${kelasList.map(k => `<option value="${k.id}">${esc(k.nama)}</option>`).join('')}
      </select>
    </div>
    <div class="eval-field">
      <label>Pilih Siswa</label>
      <select id="eval-siswa-sel" ${noSiswa ? 'disabled' : ''}>
        ${buildSiswaOptions('')}
      </select>
    </div>
    ${noSiswa ? '<p class="eval-warn">Belum ada data siswa. Tambahkan di menu Siswa terlebih dahulu.</p>' : ''}
    <button class="eval-btn" id="eval-start" ${noSiswa ? 'disabled' : ''}>Mulai Ujian</button>
  </div>
</div>`;

    container.querySelector('#eval-kelas-sel')?.addEventListener('change', e => {
        const siswaSel = container.querySelector('#eval-siswa-sel');
        siswaSel.innerHTML = buildSiswaOptions(e.target.value);
    });

    container.querySelector('#eval-start')?.addEventListener('click', () => {
        const sel      = container.querySelector('#eval-siswa-sel');
        const siswaId  = sel.value;
        const siswaName = sel.options[sel.selectedIndex]?.textContent || '';
        if (!siswaId) { alert('Pilih siswa terlebih dahulu'); return; }
        showQuiz(data, container, modulId, siswaId, siswaName);
    });
}

function showQuiz(data, container, modulId, siswaId, siswaName) {
    const qs = data.questions;
    container.innerHTML = `
<div class="quiz-header">
  <div class="quiz-student">Siswa: <strong>${esc(siswaName)}</strong></div>
  <div class="quiz-progress" id="quiz-prog">0 / ${qs.length} dijawab</div>
</div>
<div class="quiz-list">
  ${qs.map((q, qi) => `
    <div class="quiz-item" data-qi="${qi}">
      <div class="quiz-q">${qi + 1}. ${esc(q.q)}</div>
      <div class="quiz-opts" data-correct="${q.ans}">
        ${q.opts.map((o, oi) => `<div class="quiz-opt" data-idx="${oi}">${String.fromCharCode(65 + oi)}. ${esc(o)}</div>`).join('')}
      </div>
    </div>`).join('')}
</div>
<div class="quiz-submit-bar">
  <button class="eval-btn" id="quiz-submit">Kumpulkan Jawaban</button>
</div>`;

    const answers = {};

    container.addEventListener('click', e => {
        const opt = e.target.closest('.quiz-opt');
        if (!opt) return;
        if (opt.dataset['locked']) return;
        const opts = opt.closest('.quiz-opts');
        const qi   = Number(opt.closest('.quiz-item').dataset['qi']);
        const wasAnswered = answers[qi] != null;
        answers[qi] = Number(opt.dataset['idx']);

        // Deselect all in this question then mark selected
        opts.querySelectorAll('.quiz-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');

        const total = Object.keys(answers).length;
        // If this was a new answer (not a change), count went up
        if (!wasAnswered) {
            container.querySelector('#quiz-prog').textContent = `${total} / ${qs.length} dijawab`;
        }
    });

    container.querySelector('#quiz-submit').addEventListener('click', () => {
        const answered = Object.keys(answers).length;
        const belum    = qs.length - answered;
        const msg      = belum > 0
            ? `Masih <strong>${belum} soal</strong> belum dijawab.`
            : `Semua <strong>${qs.length} soal</strong> sudah dijawab.`;

        showConfirm(container, msg, async () => {
            // Lock all options
            container.querySelectorAll('.quiz-opt').forEach(o => {
                o.dataset['locked'] = '1';
                o.style.cursor = 'default';
            });

            // Calculate score
            let score = 0;
            qs.forEach((q, qi) => { if (answers[qi] === q.ans) score++; });

            // Mark correct / wrong in quiz
            qs.forEach((q, qi) => {
                const opts = container.querySelector(`[data-qi="${qi}"] .quiz-opts`);
                if (!opts) return;
                opts.querySelector(`[data-idx="${q.ans}"]`)?.classList.add('correct');
                if (answers[qi] != null && answers[qi] !== q.ans)
                    opts.querySelector(`[data-idx="${answers[qi]}"]`)?.classList.add('wrong');
            });
            container.querySelectorAll('.quiz-opt.selected').forEach(o => o.classList.remove('selected'));

            // Save to backend
            const token = localStorage.getItem('tosm_token');
            try {
                await fetch(`${API}/evaluasi`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                    body: JSON.stringify({ siswa_id: Number(siswaId), modul_id: modulId, score, total: qs.length })
                });
            } catch { /* offline fallback */ }

            showResult(container, score, qs.length, siswaName, () => showGate(data, container, modulId));
        });
    });
}

function showResult(container, score, total, siswaName, onRetry) {
    const pct   = Math.round(score / total * 100);
    const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'E';
    const pass  = pct >= 70;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:9999;
        display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,.65);backdrop-filter:blur(4px)`;
    overlay.innerHTML = `
<div style="
    background:#1a1535;border:1px solid rgba(139,92,246,.35);
    border-radius:20px;padding:36px 40px;max-width:400px;width:90%;
    display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center">
  <div style="font-size:52px;font-weight:800;color:${pass ? '#34d399' : '#f87171'};line-height:1">
    ${score}<span style="font-size:28px;font-weight:500;color:#94a3b8">/${total}</span>
  </div>
  <div style="font-size:15px;color:#94a3b8">${pct}% &mdash; Nilai <strong style="color:#e2e8f0">${grade}</strong></div>
  <div style="font-size:13px;color:#64748b">${esc(siswaName)}</div>
  <div style="font-size:16px;font-weight:700;color:${pass ? '#34d399' : '#f87171'};
    background:${pass ? 'rgba(52,211,153,.1)' : 'rgba(248,113,113,.1)'};
    padding:8px 20px;border-radius:8px;margin-top:4px">
    ${pass ? '✓ Lulus' : '✗ Belum Lulus'}
  </div>
  <div style="display:flex;gap:12px;margin-top:8px">
    <button id="res-review" style="
        padding:10px 20px;border-radius:10px;font-size:14px;cursor:pointer;
        background:transparent;border:1px solid rgba(255,255,255,.2);color:#94a3b8">Lihat Jawaban</button>
    <button id="res-done" style="
        padding:10px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;
        background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;color:#fff">Selesai</button>
  </div>
</div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#res-review').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#res-done').addEventListener('click', () => { overlay.remove(); onRetry(); });
}

function showConfirm(container, msg, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:9999;
        display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,.6);backdrop-filter:blur(4px)`;
    overlay.innerHTML = `
<div style="
    background:#1a1535;border:1px solid rgba(139,92,246,.3);
    border-radius:16px;padding:32px 36px;max-width:380px;width:90%;
    display:flex;flex-direction:column;gap:16px;text-align:center">
  <div style="font-size:19px;font-weight:700;color:#e2e8f0">Kumpulkan Jawaban?</div>
  <div style="font-size:14px;color:#94a3b8;line-height:1.7">${msg}<br>Jawaban <strong>tidak dapat diubah</strong> setelah dikumpulkan.</div>
  <div style="display:flex;gap:12px;justify-content:center;margin-top:4px">
    <button id="cfm-batal" style="
        padding:10px 24px;border-radius:10px;font-size:14px;cursor:pointer;
        background:transparent;border:1px solid rgba(255,255,255,.2);color:#94a3b8">Batal</button>
    <button id="cfm-ok" style="
        padding:10px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;
        background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;color:#fff">Ya, Kumpulkan</button>
  </div>
</div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cfm-batal').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cfm-ok').addEventListener('click', () => { overlay.remove(); onConfirm(); });
}

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
