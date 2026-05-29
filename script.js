/* ═══════════════════════════════════════════
   SKILLCRAFT STOPWATCH — script.js
   Task 02: Start / Pause / Lap / Reset
   Analog clock hands move with stopwatch
═══════════════════════════════════════════ */
 
// ── DOM refs ─────────────────────────────
const timeDisplay = document.getElementById('timeDisplay');
const msDisplay   = document.getElementById('msDisplay');
const startBtn    = document.getElementById('startBtn');
const lapBtn      = document.getElementById('lapBtn');
const resetBtn    = document.getElementById('resetBtn');
const lapList     = document.getElementById('lapList');
const canvas      = document.getElementById('clockCanvas');
const ctx         = canvas.getContext('2d');
 
// ── State ─────────────────────────────────
let running   = false;
let startTime = 0;   // performance.now() snapshot when started/resumed
let elapsed   = 0;   // total accumulated ms (paused value)
let lapStart  = 0;   // elapsed ms at last lap
let laps      = [];
let rafId     = null;
 
// ── Helpers ───────────────────────────────
function pad(n, len = 2) {
  return String(Math.floor(n)).padStart(len, '0');
}
function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
}
function formatMs(ms) {
  return '.' + pad(ms % 1000, 3);
}
 
// Returns current total ms (live while running, frozen when paused)
function currentMs() {
  return running ? elapsed + (performance.now() - startTime) : elapsed;
}
 
// ── Clock constants ───────────────────────
const CX = canvas.width  / 2;
const CY = canvas.height / 2;
const R  = canvas.width  / 2 - 10;
 
// ── Draw clock ────────────────────────────
function drawClock(ms) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
 
  /* Face */
  const faceGrad = ctx.createRadialGradient(CX, CY - 20, R * 0.1, CX, CY, R);
  faceGrad.addColorStop(0,   '#3a0e28');
  faceGrad.addColorStop(0.6, '#1a0610');
  faceGrad.addColorStop(1,   '#0d0408');
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.fillStyle = faceGrad; ctx.fill();
 
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(192,57,43,0.6)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(CX, CY, R - 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(224,92,138,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
 
  /* Minute ticks + hour numbers */
  for (let i = 0; i < 60; i++) {
    const a    = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const isHr = i % 5 === 0;
    const r1 = R - 12, r2 = r1 - (isHr ? 14 : 6);
    ctx.beginPath();
    ctx.moveTo(CX + r1 * Math.cos(a), CY + r1 * Math.sin(a));
    ctx.lineTo(CX + r2 * Math.cos(a), CY + r2 * Math.sin(a));
    ctx.strokeStyle = isHr ? 'rgba(240,160,192,0.9)' : 'rgba(240,160,192,0.3)';
    ctx.lineWidth   = isHr ? 2.5 : 1;
    ctx.stroke();
  }
  ctx.font = `500 13px 'Jost',sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(253,240,245,0.7)';
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
    const nr = R - 38;
    ctx.fillText(h, CX + nr * Math.cos(a), CY + nr * Math.sin(a));
  }
 
  /* Sub-dial (seconds ring) */
  const sdR = 46, sdCY = CY + 62;
  ctx.beginPath(); ctx.arc(CX, sdCY, sdR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(26,6,16,0.8)'; ctx.fill();
  ctx.strokeStyle = 'rgba(192,57,43,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
 
  for (let i = 0; i < 60; i++) {
    const a   = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const sr1 = sdR - 4, sr2 = sr1 - (i % 5 === 0 ? 8 : 4);
    ctx.beginPath();
    ctx.moveTo(CX + sr1 * Math.cos(a), sdCY + sr1 * Math.sin(a));
    ctx.lineTo(CX + sr2 * Math.cos(a), sdCY + sr2 * Math.sin(a));
    ctx.strokeStyle = i % 5 === 0 ? 'rgba(240,160,192,0.6)' : 'rgba(240,160,192,0.2)';
    ctx.lineWidth   = i % 5 === 0 ? 1.5 : 0.8;
    ctx.stroke();
  }
  ctx.font = `400 8px 'Jost',sans-serif`;
  ctx.fillStyle = 'rgba(253,240,245,0.35)';
  ctx.fillText('SEC', CX, sdCY - 16);
 
  /* Angles — smooth, continuous from ms */
  const totalSec = ms / 1000;          // e.g. 65.187 s
  const totalMin = totalSec / 60;      // e.g. 1.086 min
  const totalHr  = totalMin / 60;      // e.g. 0.018 hr
 
  const hrAngle  = (totalHr  % 12 / 12) * Math.PI * 2 - Math.PI / 2;
  const minAngle = (totalMin % 60 / 60) * Math.PI * 2 - Math.PI / 2;
  const secAngle = (totalSec % 60 / 60) * Math.PI * 2 - Math.PI / 2; // sub-dial
 
  /* Hour hand */
  drawHand(CX, CY, hrAngle,  R * 0.42, 5,   'rgba(253,240,245,0.95)', 'rgba(192,57,43,0.5)');
  /* Minute hand */
  drawHand(CX, CY, minAngle, R * 0.62, 3.5, 'rgba(253,240,245,0.95)', 'rgba(224,92,138,0.4)');
 
  /* Sub-dial second hand */
  const subLen = sdR - 8;
  const sxTip  = CX  + subLen * Math.cos(secAngle);
  const syTip  = sdCY + subLen * Math.sin(secAngle);
  const sxTail = CX  - subLen * 0.35 * Math.cos(secAngle);
  const syTail = sdCY - subLen * 0.35 * Math.sin(secAngle);
  ctx.beginPath();
  ctx.moveTo(sxTail, syTail); ctx.lineTo(sxTip, syTip);
  ctx.strokeStyle = '#e05c8a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.shadowColor = '#e05c8a'; ctx.shadowBlur = 6;
  ctx.stroke(); ctx.shadowBlur = 0;
 
  /* Sub-dial center dot */
  ctx.beginPath(); ctx.arc(CX, sdCY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#e05c8a'; ctx.fill();
 
  /* Main center cap */
  ctx.beginPath(); ctx.arc(CX, CY, 7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(192,57,43,0.9)'; ctx.fill();
  ctx.beginPath(); ctx.arc(CX, CY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fdf0f5'; ctx.fill();
}
 
function drawHand(cx, cy, angle, length, width, colorTip, colorBase) {
  const tx = cx + length * Math.cos(angle);
  const ty = cy + length * Math.sin(angle);
  const bx = cx - length * 0.2 * Math.cos(angle);
  const by = cy - length * 0.2 * Math.sin(angle);
  const g  = ctx.createLinearGradient(bx, by, tx, ty);
  g.addColorStop(0, colorBase); g.addColorStop(1, colorTip);
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty);
  ctx.strokeStyle = g; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.shadowColor = colorTip; ctx.shadowBlur = 8;
  ctx.stroke(); ctx.shadowBlur = 0;
}
 
// ── Render loop (runs always) ─────────────
function renderLoop() {
  const ms = currentMs();
  timeDisplay.textContent = formatTime(ms);
  msDisplay.textContent   = formatMs(ms);
  drawClock(ms);
  rafId = requestAnimationFrame(renderLoop);
}
rafId = requestAnimationFrame(renderLoop);
 
// ── Start / Pause ─────────────────────────
startBtn.addEventListener('click', toggleStart);
 
function toggleStart() {
  if (!running) {
    startTime = performance.now();   // freeze point
    running   = true;
    startBtn.querySelector('.btn-icon').textContent  = '⏸';
    startBtn.querySelector('.btn-label').textContent = 'Pause';
    startBtn.classList.add('paused');
    lapBtn.disabled   = false;
    resetBtn.disabled = false;
    document.querySelector('.time-display').classList.add('running');
  } else {
    elapsed   = currentMs();         // save accumulated
    running   = false;
    startBtn.querySelector('.btn-icon').textContent  = '▶';
    startBtn.querySelector('.btn-label').textContent = 'Resume';
    startBtn.classList.remove('paused');
    document.querySelector('.time-display').classList.remove('running');
  }
}
 
// ── Lap ───────────────────────────────────
lapBtn.addEventListener('click', recordLap);
 
function recordLap() {
  if (!running) return;
  const total = currentMs();
  const split = total - lapStart;
  lapStart = total;
  laps.push({ split, total });
 
  const splits = laps.map(l => l.split);
  const best   = Math.min(...splits);
  const slow   = splits.length > 1 ? Math.max(...splits) : -1;
 
  lapList.innerHTML = '';
  laps.slice().reverse().forEach((lap, idx) => {
    const num    = laps.length - idx;
    const isBest = laps.length > 1 && lap.split === best;
    const isSlow = laps.length > 1 && lap.split === slow;
    const li = document.createElement('li');
    li.className = 'lap-item';
    li.innerHTML = `
      <span class="lap-num">#${String(num).padStart(2,'0')}</span>
      <span class="lap-split">
        ${formatTime(lap.split)}${formatMs(lap.split)}
        ${isBest ? '<span class="badge badge-best">Best</span>' : ''}
        ${isSlow ? '<span class="badge badge-slow">Slow</span>' : ''}
      </span>
      <span class="lap-total">${formatTime(lap.total)}${formatMs(lap.total)}</span>`;
    lapList.appendChild(li);
  });
}
 
// ── Reset ─────────────────────────────────
resetBtn.addEventListener('click', resetAll);
 
function resetAll() {
  running  = false;
  elapsed  = 0;
  lapStart = 0;
  laps     = [];
 
  startBtn.querySelector('.btn-icon').textContent  = '▶';
  startBtn.querySelector('.btn-label').textContent = 'Start';
  startBtn.classList.remove('paused');
  lapBtn.disabled   = true;
  resetBtn.disabled = true;
  lapList.innerHTML = '';
  document.querySelector('.time-display').classList.remove('running');
}
 
// ── Keyboard shortcuts ────────────────────
document.addEventListener('keydown', e => {
  if (e.code === 'Space')               { e.preventDefault(); toggleStart(); }
  if (e.key.toLowerCase() === 'l' && !lapBtn.disabled)   recordLap();
  if (e.key.toLowerCase() === 'r' && !resetBtn.disabled) resetAll();
});
 
// ── Floating petals ───────────────────────
const petalColors = [
  'rgba(224,92,138,0.5)', 'rgba(240,160,192,0.4)',
  'rgba(192,57,43,0.4)',  'rgba(253,213,229,0.35)',
];
const container = document.getElementById('bgPetals');
for (let i = 0; i < 18; i++) {
  const p = document.createElement('div');
  p.className = 'petal';
  const size = 6 + Math.random() * 10;
  p.style.cssText = `
    left:${Math.random()*100}%;
    width:${size}px; height:${size}px;
    background:${petalColors[Math.floor(Math.random()*petalColors.length)]};
    animation-delay:${Math.random()*12}s;
    animation-duration:${10+Math.random()*14}s;
    border-radius:50% 0 50% 0;`;
  container.appendChild(p);
}