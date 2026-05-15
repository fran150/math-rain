const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");

const els = {
  game: document.querySelector(".game"),
  levelTitle: document.querySelector("#level-title"),
  score: document.querySelector("#score"),
  streak: document.querySelector("#streak"),
  solved: document.querySelector("#solved"),
  goal: document.querySelector("#goal"),
  speed: document.querySelector("#speed"),
  buffer: document.querySelector("#answer-buffer"),
  overlay: document.querySelector("#overlay"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayCopy: document.querySelector("#overlay-copy"),
  startAdventure: document.querySelector("#start-adventure"),
  startCalm: document.querySelector("#start-calm"),
  playerName: document.querySelector("#player-name"),
  recordsList: document.querySelector("#records-list"),
  clearRecords: document.querySelector("#clear-records"),
  levelPicker: document.querySelector("#level-picker")
};

const challenges = [
  {
    title: "Tiny Sums",
    generators: [() => addition(1, 5), () => doubles(2, 6)]
  },
  {
    title: "Plus Power",
    generators: [() => addition(2, 9), () => addition(1, 10)]
  },
  {
    title: "The 2s",
    generators: [() => multiplyBy([2], 1, 10)]
  },
  {
    title: "The 3s",
    generators: [() => multiplyBy([3], 1, 10), () => multiplyBy([2], 1, 10)]
  },
  {
    title: "4s and 5s",
    generators: [() => multiplyBy([4, 5], 1, 10), () => multiplyBy([2, 3], 2, 10)]
  },
  {
    title: "6s and 7s",
    generators: [() => multiplyBy([6, 7], 1, 10), () => multiplyBy([2, 3, 4, 5], 2, 10)]
  },
  {
    title: "8s and 9s",
    generators: [() => multiplyBy([8, 9], 1, 10), () => multiplyBy([4, 5, 6, 7], 2, 10)]
  },
  {
    title: "Mixed Mastery",
    generators: [() => multiplyBy([2, 3, 4, 5, 6, 7, 8, 9], 2, 12), () => addition(5, 14)]
  }
];

const baseSpeed = 34;
const baseSpawnMs = 1750;
const calmSpeedStep = 0.15;
const wrongAnswerPenalty = 15;
const recordsStorageKey = "mathRain.records.v1";
const playerNameStorageKey = "mathRain.playerName.v1";
const colors = ["#2f79d8", "#1d9a74", "#e55b48", "#d7981f", "#7b61d1"];
const state = {
  running: false,
  calm: false,
  selectedChallengeIndex: 0,
  gameLevel: 0,
  awaitingNextLevel: false,
  calmSpeedMultiplier: 1,
  score: 0,
  lastRecordedScore: 0,
  streak: 0,
  solved: 0,
  totalSolved: 0,
  answer: "",
  rainPaused: false,
  drops: [],
  particles: [],
  floatingTexts: [],
  nextDropId: 1,
  spawnTimer: 0,
  lastTime: 0,
  shakeTimer: 0
};

function choice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addition(min, max) {
  const a = randomInt(min, max);
  const b = randomInt(min, max);
  return { text: `${a}+${b}=?`, answer: a + b };
}

function doubles(min, max) {
  const a = randomInt(min, max);
  return { text: `${a}+${a}=?`, answer: a + a };
}

function multiplyBy(tables, min, max) {
  const a = choice(tables);
  const b = randomInt(min, max);
  return Math.random() > 0.5
    ? { text: `${a}x${b}=?`, answer: a * b }
    : { text: `${b}x${a}=?`, answer: a * b };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function activeChallengeIndex() {
  const complexityBump = state.calm ? 0 : Math.floor(state.gameLevel / 2);
  return Math.min(state.selectedChallengeIndex + complexityBump, challenges.length - 1);
}

function currentChallenge() {
  return challenges[activeChallengeIndex()];
}

function regularSpeedMultiplier() {
  return 1 + Math.ceil(state.gameLevel / 2) * 0.14;
}

function currentSpeedMultiplier() {
  return state.calm ? state.calmSpeedMultiplier : regularSpeedMultiplier();
}

function currentGoal() {
  return 12 + Math.min(12, state.gameLevel * 2);
}

function currentSpawnMs() {
  return Math.max(760, baseSpawnMs / Math.pow(currentSpeedMultiplier(), 0.9));
}

function currentDropSpeed() {
  return baseSpeed * currentSpeedMultiplier();
}

function selectChallenge(index) {
  state.selectedChallengeIndex = index;
  state.awaitingNextLevel = false;
  syncHud();
}

function adjustCalmSpeed(delta) {
  state.calmSpeedMultiplier = clamp(
    state.calmSpeedMultiplier + delta,
    0.4,
    2.5
  );

  if (state.calm && state.running && !state.rainPaused) {
    for (const drop of state.drops.filter((candidate) => !candidate.landed)) {
      drop.vy = currentDropSpeed();
    }
  }

  syncHud();
}

function startGame({ calm = false, continueRun = false } = {}) {
  savePlayerName();
  Object.assign(state, {
    running: true,
    calm,
    gameLevel: continueRun ? state.gameLevel : 0,
    awaitingNextLevel: false,
    score: continueRun ? state.score : 0,
    lastRecordedScore: continueRun ? state.lastRecordedScore : 0,
    streak: 0,
    solved: 0,
    totalSolved: continueRun ? state.totalSolved : 0,
    answer: "",
    rainPaused: false,
    drops: [],
    particles: [],
    floatingTexts: [],
    spawnTimer: 350,
    lastTime: performance.now(),
    shakeTimer: 0
  });

  els.overlay.classList.remove("is-visible");
  syncHud();
  requestAnimationFrame(tick);
}

function showOverlay(title, copy, buttonLabel = "Play again", options = {}) {
  els.overlayTitle.textContent = title;
  els.overlayCopy.textContent = copy;
  els.startAdventure.textContent = buttonLabel;
  els.overlay.classList.toggle("is-session-intermission", Boolean(options.intermission));
  renderRecords();
  els.overlay.classList.add("is-visible");
}

function endSession(reason) {
  const wasAwaitingNextLevel = state.awaitingNextLevel;
  state.running = false;

  if (!state.calm) {
    recordScore(reason, wasAwaitingNextLevel);
  }

  state.awaitingNextLevel = false;

  const title = reason === "pile" ? "The pile reached the top" : "Session ended";
  const copy = state.calm
    ? "Practice is finished. Calm practice does not save scores."
    : `${playerName()} scored ${state.score} and solved ${state.totalSolved} operations.`;

  syncHud();
  showOverlay(title, copy, "Start");
}

function playerName() {
  const name = els.playerName.value.trim();
  return name || "Player";
}

function savePlayerName() {
  try {
    localStorage.setItem(playerNameStorageKey, playerName());
  } catch {
    // Records are a nice extra; gameplay should continue if storage is blocked.
  }
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recordsStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(recordsStorageKey, JSON.stringify(records));
  } catch {
    // Ignore storage failures; the score still appeared during play.
  }
}

function challengeLabel(index) {
  return challenges[clamp(index, 0, challenges.length - 1)].title;
}

function formatRecordDate(isoDate) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(isoDate));
}

function recordScore(reason, wasAwaitingNextLevel = false) {
  if (state.calm || state.score <= 0 || state.lastRecordedScore === state.score) return;

  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: playerName(),
    score: state.score,
    solved: state.totalSolved,
    level: wasAwaitingNextLevel ? state.gameLevel : state.gameLevel + 1,
    challenge: challengeLabel(state.selectedChallengeIndex),
    finalChallenge: currentChallenge().title,
    date: new Date().toISOString(),
    reason
  };
  const records = [...loadRecords(), record]
    .sort((a, b) => b.score - a.score || b.solved - a.solved)
    .slice(0, 10);
  saveRecords(records);
  state.lastRecordedScore = state.score;
  renderRecords();
}

function renderRecords() {
  const records = loadRecords();
  els.recordsList.innerHTML = "";

  if (!records.length) {
    const empty = document.createElement("li");
    empty.className = "empty-records";
    empty.textContent = "No records yet.";
    els.recordsList.replaceChildren(empty);
    return;
  }

  for (const [index, record] of records.entries()) {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="record-rank">${index + 1}</span>
      <span class="record-main">
        <span class="record-name"></span>
        <span class="record-meta"></span>
      </span>
      <span class="record-score"></span>
    `;
    item.querySelector(".record-name").textContent = record.name;
    item.querySelector(".record-meta").textContent =
      `Level ${record.level} · ${record.solved} solved · ${record.challenge} · ${formatRecordDate(record.date)}`;
    item.querySelector(".record-score").textContent = String(record.score);
    els.recordsList.appendChild(item);
  }
}

function spawnDrop() {
  const challenge = currentChallenge();
  const operation = choice(challenge.generators)();
  const margin = 72;
  const width = canvas.clientWidth;
  const x = randomInt(margin, Math.max(margin, width - margin));
  const adaptiveBoost = state.calm
    ? 0
    : Math.min(12, state.solved * 0.35 + state.streak * 0.2);

  state.drops.push({
    id: state.nextDropId++,
    text: operation.text,
    answer: operation.answer,
    x,
    y: 98,
    vy: currentDropSpeed() + adaptiveBoost,
    color: choice(colors),
    width: 126,
    height: 52,
    landed: false,
    wobble: Math.random() * Math.PI * 2
  });
}

function tick(now) {
  if (!state.running) return;

  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  draw(now);
  requestAnimationFrame(tick);
}

function update(dt) {
  state.shakeTimer = Math.max(0, state.shakeTimer - dt);

  if (!state.rainPaused) {
    state.spawnTimer -= dt * 1000;
  }

  if (!state.rainPaused && state.spawnTimer <= 0) {
    spawnDrop();
    const calmGap = state.calm ? 1.35 : 1;
    state.spawnTimer = currentSpawnMs() * calmGap * randomInt(86, 118) / 100;
  }

  const fallingDrops = state.drops
    .filter((candidate) => !candidate.landed)
    .sort((a, b) => b.y - a.y);

  for (const drop of fallingDrops) {
    if (state.rainPaused) break;

    const previousY = drop.y;
    drop.y += drop.vy * dt;
    drop.wobble += dt * 2.4;

    const landingY = crossedLandingYFor(drop, previousY);
    if (landingY !== null) {
      drop.landed = true;
      drop.vy = 0;
      drop.y = landingY;
      popParticles(drop.x, drop.y, drop.color, 8);
      if (!state.calm) {
        state.streak = 0;
      }

      if (state.calm && pileTouchesTop()) {
        pauseCalmRain();
      } else if (!state.calm && pileTouchesTop()) {
        endSession("pile");
      }
    }
  }

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 190 * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  for (const text of state.floatingTexts) {
    text.y += text.vy * dt;
    text.life -= dt;
  }
  state.floatingTexts = state.floatingTexts.filter((text) => text.life > 0);

  if (!state.calm && state.solved >= currentGoal()) {
    state.running = false;
    state.gameLevel += 1;
    state.awaitingNextLevel = true;
    const challengeWillIncrease = Math.floor(state.gameLevel / 2) > Math.floor((state.gameLevel - 1) / 2);
    const nextChallengeIndex = activeChallengeIndex();
    const atMaxComplexity = nextChallengeIndex === challenges.length - 1;
    showOverlay(
      "Level clear",
      challengeWillIncrease && !atMaxComplexity
        ? `Score so far: ${state.score}. Next up: ${challenges[nextChallengeIndex].title}.`
        : `Score so far: ${state.score}. Next round: ${challenges[nextChallengeIndex].title}. The rain gets a little quicker.`,
      "Next level",
      { intermission: true }
    );
  }

  syncHud();
}

function draw(now) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height, now);
  drawPile(width, height);

  for (const drop of state.drops.filter((candidate) => candidate.landed)) {
    drawDrop(drop);
  }

  for (const drop of state.drops.filter((candidate) => !candidate.landed)) {
    drawDrop(drop);
  }

  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (const text of state.floatingTexts) {
    ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
    ctx.fillStyle = text.color;
    ctx.font = "900 24px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.label, text.x, text.y);
    ctx.globalAlpha = 1;
  }
}

function drawBackground(width, height, now) {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  const drift = (now * 0.018) % 44;
  for (let x = -40; x < width + 40; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x + drift, 0);
    ctx.lineTo(x - 120 + drift, height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPile(width, height) {
  ctx.fillStyle = "rgba(32, 32, 42, 0.08)";
  ctx.fillRect(0, height - 46, width, 46);
}

function drawDrop(drop) {
  const wobbleX = drop.landed ? 0 : Math.sin(drop.wobble) * 4;
  const x = drop.x + wobbleX - drop.width / 2;
  const y = drop.y - drop.height / 2;

  ctx.save();
  if (state.shakeTimer > 0) {
    ctx.translate(Math.sin(performance.now() * 0.08) * 4, 0);
  }
  if (drop.landed) {
    ctx.fillStyle = "rgba(32, 32, 42, 0.16)";
    roundedRect(ctx, x + 5, y + drop.height - 3, drop.width - 10, 8, 6);
    ctx.fill();
  }
  ctx.fillStyle = drop.color;
  roundedRect(ctx, x, y, drop.width, drop.height, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  roundedRect(ctx, x + 8, y + 7, drop.width - 16, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "900 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(drop.text, drop.x + wobbleX, drop.y + 3);
  ctx.restore();
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function popParticles(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomInt(60, 190);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      size: randomInt(3, 7),
      color,
      life: randomInt(38, 75) / 100,
      maxLife: 0.75
    });
  }
}

function showFloatingText(label, x, y, color = "#e55b48") {
  state.floatingTexts.push({
    label,
    x,
    y,
    vy: -42,
    color,
    life: 0.85,
    maxLife: 0.85
  });
}

function landedDrops() {
  return state.drops.filter((drop) => drop.landed);
}

function horizontalOverlap(a, b) {
  const left = Math.max(a.x - a.width / 2, b.x - b.width / 2);
  const right = Math.min(a.x + a.width / 2, b.x + b.width / 2);
  return Math.max(0, right - left);
}

function crossedLandingYFor(drop, previousY) {
  const floorSurface = canvas.clientHeight - 46;
  const previousBottom = previousY + drop.height / 2;
  const currentBottom = drop.y + drop.height / 2;
  let crossedSurfaceY = currentBottom >= floorSurface ? floorSurface : null;

  for (const landed of landedDrops()) {
    if (horizontalOverlap(drop, landed) > 0) {
      const landedTop = landed.y - landed.height / 2;
      const crossedFromAbove = previousBottom <= landedTop && currentBottom >= landedTop;
      if (
        crossedFromAbove &&
        (crossedSurfaceY === null || landedTop < crossedSurfaceY)
      ) {
        crossedSurfaceY = landedTop;
      }
    }
  }

  return crossedSurfaceY === null ? null : crossedSurfaceY - drop.height / 2;
}

function pileTouchesTop() {
  const topLimit = 96;
  return landedDrops().some((drop) => drop.y - drop.height / 2 <= topLimit);
}

function isSupported(drop) {
  const floorSurface = canvas.clientHeight - 46;
  const bottom = drop.y + drop.height / 2;
  if (bottom >= floorSurface - 1) return true;

  return landedDrops().some((candidate) => {
    if (candidate.id === drop.id) return false;
    const candidateTop = candidate.y - candidate.height / 2;
    return horizontalOverlap(drop, candidate) > 0 && Math.abs(bottom - candidateTop) <= 3;
  });
}

function releaseUnsupportedDrops() {
  let released = true;
  while (released) {
    released = false;
    for (const drop of landedDrops()) {
      if (!isSupported(drop)) {
        drop.landed = false;
        drop.vy = Math.max(drop.vy, 90);
        released = true;
      }
    }
  }
}

function pauseCalmRain() {
  state.rainPaused = true;
  for (const drop of state.drops.filter((candidate) => !candidate.landed)) {
    drop.vy = 0;
  }
}

function resumeCalmRainIfThereIsRoom() {
  if (!state.calm || !state.rainPaused || pileTouchesTop()) return;

  state.rainPaused = false;
  for (const drop of state.drops.filter((candidate) => !candidate.landed)) {
    drop.vy = Math.max(drop.vy, currentDropSpeed());
  }
  state.spawnTimer = Math.min(state.spawnTimer, currentSpawnMs());
}

function tryAnswer() {
  if (!state.answer) return;
  const answer = Number(state.answer);
  const matches = state.drops
    .filter((drop) => drop.answer === answer)
    .sort((a, b) => b.y - a.y);

  if (matches.length) {
    clearDrop(matches[0]);
    return;
  }

  const couldBecomeAnswer = state.drops.some((drop) =>
    String(drop.answer).startsWith(state.answer)
  );

  if (!couldBecomeAnswer) {
    state.answer = "";
    state.shakeTimer = 0.28;
    state.streak = 0;
    if (!state.calm) {
      state.score = Math.max(0, state.score - wrongAnswerPenalty);
      showFloatingText(
        `-${wrongAnswerPenalty}`,
        canvas.clientWidth / 2,
        canvas.clientHeight - 118
      );
    }
    syncHud();
  }
}

function clearDrop(drop) {
  state.drops = state.drops.filter((candidate) => candidate.id !== drop.id);
  state.solved += 1;
  state.totalSolved += 1;
  state.streak += 1;
  if (!state.calm) {
    state.score += 50 + state.streak * 8 + Math.max(0, Math.floor((canvas.clientHeight - drop.y) / 10));
  }
  releaseUnsupportedDrops();
  resumeCalmRainIfThereIsRoom();
  state.answer = "";
  popParticles(drop.x, drop.y, drop.color);
  syncHud();
}

function syncHud() {
  const challenge = currentChallenge();
  els.levelTitle.textContent = state.rainPaused
    ? `Practice full: ${challenge.title}`
    : state.calm
      ? `Practice: ${challenge.title}`
      : `Level ${state.gameLevel + 1}: ${challenge.title}`;
  els.score.textContent = String(state.score);
  els.streak.textContent = String(state.streak);
  els.solved.textContent = String(state.solved);
  els.goal.textContent = state.calm ? "∞" : String(currentGoal());
  els.speed.textContent = `${currentSpeedMultiplier().toFixed(1)}x`;
  els.buffer.textContent = state.answer || "...";
  els.game.classList.toggle("is-calm", state.calm);
  for (const [index, button] of [...els.levelPicker.children].entries()) {
    button.classList.toggle("is-selected", index === state.selectedChallengeIndex);
  }
}

function buildLevelPicker() {
  els.levelPicker.innerHTML = "";
  challenges.forEach((challenge, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = challenge.title;
    button.addEventListener("click", () => selectChallenge(index));
    els.levelPicker.appendChild(button);
  });
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (event.target === els.playerName) return;
  if (!state.running && state.awaitingNextLevel && event.key === "Escape") {
    endSession("ended");
    event.preventDefault();
    return;
  }
  if (!state.running) return;

  if (/^\d$/.test(event.key)) {
    state.answer = (state.answer + event.key).slice(0, 3);
    syncHud();
    tryAnswer();
    event.preventDefault();
  }

  if (event.key === "Backspace") {
    state.answer = state.answer.slice(0, -1);
    syncHud();
    event.preventDefault();
  }

  if (state.calm && event.key === "[") {
    adjustCalmSpeed(-calmSpeedStep);
    event.preventDefault();
  }

  if (state.calm && event.key === "]") {
    adjustCalmSpeed(calmSpeedStep);
    event.preventDefault();
  }

  if (state.calm && event.key === "\\") {
    state.calmSpeedMultiplier = 1;
    adjustCalmSpeed(0);
    event.preventDefault();
  }

  if (event.key === "Escape") {
    endSession("ended");
    event.preventDefault();
  }
});

els.startAdventure.addEventListener("click", () => {
  startGame({ calm: false, continueRun: state.awaitingNextLevel });
});

els.startCalm.addEventListener("click", () => {
  startGame({ calm: true });
});

els.playerName.addEventListener("change", savePlayerName);
els.clearRecords.addEventListener("click", () => {
  saveRecords([]);
  renderRecords();
});

try {
  els.playerName.value = localStorage.getItem(playerNameStorageKey) || "";
} catch {
  els.playerName.value = "";
}

resizeCanvas();
buildLevelPicker();
renderRecords();
syncHud();
