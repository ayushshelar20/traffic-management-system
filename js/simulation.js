// ===== SIMULATION ENGINE =====
// Renders the intersection, manages vehicles, integrates with AI controller

const Simulation = (() => {
  let canvas, ctx;
  let running = false;
  let animFrameId = null;
  let vehicles = [];
  let speedMultiplier = 2;
  let tickAccumulator = 0;
  let lastTimestamp = 0;
  const TICK_INTERVAL = 1000; // 1 second per AI tick

  // Spawn timers per road
  const spawnTimers = { north: 0, south: 0, east: 0, west: 0 };

  // Auto-emergency system
  let autoEmergencyTimer = null;
  let autoEmergencyTimeout = null;
  const AUTO_EMERGENCY_MIN = 30000; // 30 seconds
  const AUTO_EMERGENCY_MAX = 30000; // 30 seconds (fixed interval)
  const AUTO_EMERGENCY_DURATION = 10000; // 10 seconds active

  function init() {
    canvas = document.getElementById('sim-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 600;

    // Button handlers
    document.getElementById('btn-start').addEventListener('click', toggleRun);
    document.getElementById('btn-reset').addEventListener('click', reset);

    const slider = document.getElementById('speed-slider');
    slider.addEventListener('input', () => {
      speedMultiplier = parseInt(slider.value);
      document.getElementById('speed-val').textContent = speedMultiplier + 'x';
    });

    const emergToggle = document.getElementById('emergency-toggle');
    emergToggle.addEventListener('change', () => {
      const roadRow = document.getElementById('emergency-road-row');
      if (emergToggle.checked) {
        roadRow.style.display = 'flex';
        const road = document.getElementById('emergency-road').value;
        TrafficAI.activateEmergency(road);
        addLog('🚨 EMERGENCY activated on ' + road.toUpperCase());
        playEmergencySound();
        showEmergencyBanner(road);
      } else {
        roadRow.style.display = 'none';
        TrafficAI.deactivateEmergency();
        addLog('✅ Emergency deactivated, resuming normal control');
        hideEmergencyBanner();
        stopEmergencySiren();
      }
    });

    document.getElementById('emergency-road').addEventListener('change', (e) => {
      if (emergToggle.checked) {
        TrafficAI.activateEmergency(e.target.value);
        addLog('🚨 Emergency switched to ' + e.target.value.toUpperCase());
        showEmergencyBanner(e.target.value);
      }
    });

    drawStatic();
  }

  function toggleRun() {
    if (running) stop(); else start();
  }

  function start() {
    if (running) return;
    running = true;
    lastTimestamp = performance.now();
    TrafficAI.state.phase = 'idle';
    document.getElementById('btn-start').textContent = '⏸ Pause';
    document.getElementById('sim-status').textContent = '▶ Running';
    document.getElementById('sim-status').style.background = 'rgba(34,197,94,0.15)';
    document.getElementById('sim-status').style.color = 'var(--green)';
    addLog('▶ Simulation started');
    scheduleAutoEmergency();
    loop(performance.now());
  }

  function stop() {
    running = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    document.getElementById('btn-start').textContent = '▶ Resume';
    document.getElementById('sim-status').textContent = '⏸ Paused';
    document.getElementById('sim-status').style.background = 'rgba(245,158,11,0.15)';
    document.getElementById('sim-status').style.color = 'var(--yellow)';
    addLog('⏸ Simulation paused');
    clearAutoEmergency();
  }

  function reset() {
    stop();
    vehicles = [];
    TrafficAI.state.phase = 'idle';
    TrafficAI.state.signals = { north:'red', south:'red', east:'red', west:'red' };
    TrafficAI.state.congestion = { north:0, south:0, east:0, west:0 };
    TrafficAI.state.currentGreen = null;
    TrafficAI.state.timer = 0;
    TrafficAI.state.history = [];
    TrafficAI.state.totalGreenTime = { north:0, south:0, east:0, west:0 };
    // Reset emergency
    TrafficAI.deactivateEmergency();
    const emergToggle = document.getElementById('emergency-toggle');
    if (emergToggle) emergToggle.checked = false;
    const roadRow = document.getElementById('emergency-road-row');
    if (roadRow) roadRow.style.display = 'none';
    hideEmergencyBanner();
    clearAutoEmergency();

    document.getElementById('btn-start').textContent = '▶ Start Simulation';
    document.getElementById('sim-status').textContent = '⏸ Stopped';
    document.getElementById('sim-status').style.background = 'rgba(239,68,68,0.15)';
    document.getElementById('sim-status').style.color = 'var(--red)';
    document.getElementById('ai-log').innerHTML = '<div class="log-entry"><span class="log-time">--:--</span><span class="log-msg">Waiting to start simulation...</span></div>';
    drawStatic();
    updateUI();
  }

  // ===== AUTO EMERGENCY SYSTEM =====
  function scheduleAutoEmergency() {
    clearAutoEmergency();
    const delay = AUTO_EMERGENCY_MIN + Math.random() * (AUTO_EMERGENCY_MAX - AUTO_EMERGENCY_MIN);
    autoEmergencyTimer = setTimeout(() => {
      if (!running) return;
      const roads = ['north', 'south', 'east', 'west'];
      // Pick a road that has a RED signal (not green) so the override is visible
      const redRoads = roads.filter(r => TrafficAI.state.signals[r] !== 'green');
      const road = redRoads.length > 0
        ? redRoads[Math.floor(Math.random() * redRoads.length)]
        : roads[Math.floor(Math.random() * roads.length)];
      triggerAutoEmergency(road);
    }, delay);
  }

  function triggerAutoEmergency(road) {
    TrafficAI.activateEmergency(road);
    const emergToggle = document.getElementById('emergency-toggle');
    if (emergToggle) emergToggle.checked = true;
    const roadRow = document.getElementById('emergency-road-row');
    if (roadRow) roadRow.style.display = 'flex';
    const roadSelect = document.getElementById('emergency-road');
    if (roadSelect) roadSelect.value = road;

    // Spawn exactly ONE emergency vehicle (ambulance) on this road
    const lane = Math.random() < 0.5 ? 0 : 1;
    vehicles.push(new Vehicle(road, lane, true));

    addLog(`🚨 AUTO-EMERGENCY on ${road.toUpperCase()} — 🚑 ambulance approaching!`);
    playEmergencySound();
    showEmergencyBanner(road);

    // Auto-deactivate after duration
    autoEmergencyTimeout = setTimeout(() => {
      TrafficAI.deactivateEmergency();
      if (emergToggle) emergToggle.checked = false;
      if (roadRow) roadRow.style.display = 'none';
      hideEmergencyBanner();
      stopEmergencySiren();
      addLog('✅ Emergency cleared — ambulance passed, resuming normal control');
      // Schedule next
      if (running) scheduleAutoEmergency();
    }, AUTO_EMERGENCY_DURATION);
  }

  function clearAutoEmergency() {
    if (autoEmergencyTimer) { clearTimeout(autoEmergencyTimer); autoEmergencyTimer = null; }
    if (autoEmergencyTimeout) { clearTimeout(autoEmergencyTimeout); autoEmergencyTimeout = null; }
  }

  // ===== EMERGENCY BANNER =====
  function showEmergencyBanner(road) {
    let banner = document.getElementById('emergency-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'emergency-banner';
      banner.className = 'emergency-banner';
      document.body.prepend(banner);
    }
    banner.innerHTML = `<span class="pulse-dot"></span> 🚨 EMERGENCY VEHICLE — ${road.toUpperCase()} road cleared for passage <span class="pulse-dot"></span>`;
    requestAnimationFrame(() => banner.classList.add('active'));
  }

  function hideEmergencyBanner() {
    const banner = document.getElementById('emergency-banner');
    if (banner) banner.classList.remove('active');
  }

  // Main animation loop
  function loop(timestamp) {
    if (!running) return;
    const delta = (timestamp - lastTimestamp) * speedMultiplier;
    lastTimestamp = timestamp;
    tickAccumulator += delta;

    // AI tick every second (scaled)
    while (tickAccumulator >= TICK_INTERVAL) {
      tickAccumulator -= TICK_INTERVAL;
      const result = TrafficAI.tick();
      if (result === 'start' || result === 'switch') {
        const road = TrafficAI.state.currentGreen;
        const dur = TrafficAI.state.greenDurations[road];
        const cong = TrafficAI.state.congestion[road].toFixed(2);
        addLog(`🟢 GREEN → ${road.toUpperCase()} (${dur}s, congestion: ${cong}x)`);
      } else if (result === 'yellow') {
        addLog(`🟡 YELLOW → ${TrafficAI.state.currentGreen?.toUpperCase()}`);
      }
      spawnVehicles();
    }

    // Update vehicles
    const signals = TrafficAI.state.signals;
    vehicles.forEach(v => v.update(signals[v.direction], vehicles));
    vehicles = vehicles.filter(v => !v.removed);

    // Draw
    draw();
    updateUI();

    animFrameId = requestAnimationFrame(loop);
  }

  // Spawn vehicles based on congestion
  function spawnVehicles() {
    TrafficAI.ROADS.forEach(road => {
      spawnTimers[road]--;
      if (spawnTimers[road] <= 0) {
        const congestion = TrafficAI.state.congestion[road] || 1;
        // More congestion = more vehicles
        const spawnChance = Math.min(0.8, 0.2 + (congestion - 1) * 0.3);
        if (Math.random() < spawnChance) {
          const lane = Math.random() < 0.5 ? 0 : 1;
          const isEmergency = false; // Only the single ambulance spawned at trigger
          vehicles.push(new Vehicle(road, lane, isEmergency));
        }
        // Reset timer (less time between spawns when congested)
        spawnTimers[road] = Math.max(1, Math.round(5 - congestion * 1.5));
      }
    });
    // Cap total vehicles
    if (vehicles.length > 80) {
      vehicles = vehicles.filter(v => !v.passed).slice(0, 80);
    }
  }

  // Draw everything
  function draw() {
    ctx.clearRect(0, 0, 600, 600);
    drawRoads();
    drawTrafficLights();
    vehicles.forEach(v => v.draw(ctx));
  }

  // Draw static roads (also used for initial render)
  function drawStatic() {
    ctx.clearRect(0, 0, 600, 600);
    drawRoads();
    drawTrafficLights();
  }

  function drawRoads() {
    const c = 300, rw = 70; // center, road half-width
    // Background
    ctx.fillStyle = '#1a2332';
    ctx.fillRect(0, 0, 600, 600);

    // Grass areas (4 quadrants)
    ctx.fillStyle = '#1b3a2a';
    ctx.fillRect(0, 0, c - rw, c - rw);
    ctx.fillRect(c + rw, 0, c - rw, c - rw);
    ctx.fillRect(0, c + rw, c - rw, c - rw);
    ctx.fillRect(c + rw, c + rw, c - rw, c - rw);

    // Roads
    ctx.fillStyle = '#2a3444';
    // Vertical road
    ctx.fillRect(c - rw, 0, rw * 2, 600);
    // Horizontal road
    ctx.fillRect(0, c - rw, 600, rw * 2);

    // Intersection
    ctx.fillStyle = '#323e50';
    ctx.fillRect(c - rw, c - rw, rw * 2, rw * 2);

    // Lane markings - dashed center lines
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);

    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(c, 0); ctx.lineTo(c, c - rw);
    ctx.moveTo(c, c + rw); ctx.lineTo(c, 600);
    ctx.stroke();

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, c); ctx.lineTo(c - rw, c);
    ctx.moveTo(c + rw, c); ctx.lineTo(600, c);
    ctx.stroke();

    ctx.setLineDash([]);

    // Stop lines
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    // North approach (bottom)
    ctx.beginPath(); ctx.moveTo(c, c + rw + 2); ctx.lineTo(c + rw - 5, c + rw + 2); ctx.stroke();
    // South approach (top)
    ctx.beginPath(); ctx.moveTo(c - rw + 5, c - rw - 2); ctx.lineTo(c, c - rw - 2); ctx.stroke();
    // East approach (left)
    ctx.beginPath(); ctx.moveTo(c - rw - 2, c); ctx.lineTo(c - rw - 2, c + rw - 5); ctx.stroke();
    // West approach (right)
    ctx.beginPath(); ctx.moveTo(c + rw + 2, c - rw + 5); ctx.lineTo(c + rw + 2, c); ctx.stroke();

    // Crosswalk stripes
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 5; i++) {
      // North
      ctx.fillRect(c + 4 + i * 12, c + rw + 6, 8, 12);
      // South
      ctx.fillRect(c - rw + 8 + i * 12, c - rw - 18, 8, 12);
      // East
      ctx.fillRect(c - rw - 18, c + 4 + i * 12, 12, 8);
      // West
      ctx.fillRect(c + rw + 6, c - rw + 8 + i * 12, 12, 8);
    }

    // Direction labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', c + 35, 20);
    ctx.fillText('S', c - 35, 592);
    ctx.fillText('E', 588, c + 35);
    ctx.fillText('W', 14, c - 35);
  }

  function drawTrafficLights() {
    const c = 300, rw = 70;
    const signals = TrafficAI.state.signals;
    const positions = {
      north: { x: c + rw + 12, y: c + rw + 12 },
      south: { x: c - rw - 12, y: c - rw - 12 },
      east:  { x: c - rw - 12, y: c + rw + 12 },
      west:  { x: c + rw + 12, y: c - rw - 12 }
    };

    Object.entries(positions).forEach(([road, pos]) => {
      const signal = signals[road];
      // Housing
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.roundRect(pos.x - 8, pos.y - 14, 16, 28, 4);
      ctx.fill();

      // Red
      ctx.fillStyle = signal === 'red' ? '#ef4444' : '#3a1515';
      ctx.beginPath(); ctx.arc(pos.x, pos.y - 7, 4, 0, Math.PI * 2); ctx.fill();
      if (signal === 'red') {
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;
      }

      // Yellow
      ctx.fillStyle = signal === 'yellow' ? '#f59e0b' : '#3a3015';
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2); ctx.fill();
      if (signal === 'yellow') {
        ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;
      }

      // Green
      ctx.fillStyle = signal === 'green' ? '#22c55e' : '#153a1f';
      ctx.beginPath(); ctx.arc(pos.x, pos.y + 7, 4, 0, Math.PI * 2); ctx.fill();
      if (signal === 'green') {
        ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;
      }
    });
  }

  // Update sidebar UI
  function updateUI() {
    const signals = TrafficAI.state.signals;
    const timer = TrafficAI.state.timer;

    TrafficAI.ROADS.forEach(road => {
      const dir = road[0]; // n, s, e, w
      const el = document.getElementById('tl-' + road);
      if (!el) return;

      const bulbs = el.querySelectorAll('.tl-bulb');
      bulbs.forEach(b => b.classList.remove('on'));
      const signal = signals[road];
      if (signal === 'red') bulbs[0].classList.add('on');
      else if (signal === 'yellow') bulbs[1].classList.add('on');
      else if (signal === 'green') bulbs[2].classList.add('on');

      const timerEl = el.querySelector('.tl-timer');
      timerEl.textContent = TrafficAI.state.currentGreen === road ? timer + 's' : '--';

      // Density bars
      const pct = TrafficAI.getCongestionPercent(road);
      const level = TrafficAI.getCongestionLevel(road);
      const fill = document.getElementById('density-' + dir);
      const val = document.getElementById('density-' + dir + '-val');
      if (fill) {
        fill.style.width = pct + '%';
        fill.className = 'density-fill ' + level;
      }
      if (val) val.textContent = pct + '%';
    });

    // Emergency visual
    const panel = document.querySelector('.sim-canvas-wrap');
    if (TrafficAI.state.emergency.active) {
      panel.classList.add('emergency-active');
    } else {
      panel.classList.remove('emergency-active');
    }

    // Save state to localStorage for visualization page
    try {
      localStorage.setItem('trafficState', JSON.stringify({
        congestion: TrafficAI.state.congestion,
        signals: TrafficAI.state.signals,
        history: TrafficAI.state.history,
        totalGreenTime: TrafficAI.state.totalGreenTime,
        timestamp: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function addLog(msg) {
    const log = document.getElementById('ai-log');
    if (!log) return;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${msg}</span>`;
    log.prepend(entry);
    // Keep last 30 entries
    while (log.children.length > 30) log.removeChild(log.lastChild);
  }

  // ===== CONTINUOUS AMBULANCE SIREN =====
  let sirenCtx = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenInterval = null;

  function playEmergencySound() {
    stopEmergencySiren(); // clear any existing
    try {
      sirenCtx = new (window.AudioContext || window.webkitAudioContext)();
      sirenOsc = sirenCtx.createOscillator();
      sirenGain = sirenCtx.createGain();
      sirenOsc.connect(sirenGain);
      sirenGain.connect(sirenCtx.destination);
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 600;
      sirenGain.gain.value = 0.12;
      sirenOsc.start();

      // Wail up and down like a real ambulance siren
      let goingUp = true;
      sirenInterval = setInterval(() => {
        if (!sirenOsc) return;
        const now = sirenCtx.currentTime;
        if (goingUp) {
          sirenOsc.frequency.linearRampToValueAtTime(1200, now + 0.6);
        } else {
          sirenOsc.frequency.linearRampToValueAtTime(600, now + 0.6);
        }
        goingUp = !goingUp;
      }, 600);
    } catch (e) { /* audio not available */ }
  }

  function stopEmergencySiren() {
    if (sirenInterval) { clearInterval(sirenInterval); sirenInterval = null; }
    if (sirenOsc) { try { sirenOsc.stop(); } catch(e) {} sirenOsc = null; }
    if (sirenGain) { sirenGain = null; }
    if (sirenCtx) { try { sirenCtx.close(); } catch(e) {} sirenCtx = null; }
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

  return { start, stop, reset };
})();
