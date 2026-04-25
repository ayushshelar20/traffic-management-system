// ===== AI TRAFFIC CONTROLLER =====
// Manages signal decisions, congestion calculation, and emergency override

const TrafficAI = (() => {
  // Road configuration
  const ROADS = ['north', 'south', 'east', 'west'];
  const NORMAL_TRAVEL_TIME = { north: 120, south: 130, east: 110, west: 125 }; // seconds
  const BASE_GREEN = 15;
  const MAX_GREEN = 60;
  const YELLOW_DURATION = 3;

  // State
  const state = {
    signals: { north: 'red', south: 'red', east: 'red', west: 'red' },
    congestion: { north: 0, south: 0, east: 0, west: 0 },
    travelTimes: { north: 120, south: 130, east: 110, west: 125 },
    greenDurations: { north: 20, south: 20, east: 20, west: 20 },
    currentGreen: null,
    timer: 0,
    phase: 'idle', // idle, green, yellow, switching
    emergency: { active: false, road: null },
    cycleIndex: 0,
    priorityOrder: ['north', 'east', 'south', 'west'],
    history: [],
    totalGreenTime: { north: 0, south: 0, east: 0, west: 0 }
  };

  // Generate simulated traffic data (mimics API response)
  function fetchTrafficData() {
    const data = {};
    ROADS.forEach(road => {
      // Simulate varying traffic with some randomness
      const base = NORMAL_TRAVEL_TIME[road];
      const variation = (Math.random() - 0.3) * 0.8; // bias toward congestion
      const multiplier = 1 + Math.max(0, variation);
      data[road] = Math.round(base * multiplier);
    });
    return data;
  }

  // Calculate congestion ratio
  function calculateCongestion(currentTime, normalTime) {
    return currentTime / normalTime;
  }

  // Update congestion levels from travel time data
  function updateCongestion() {
    state.travelTimes = fetchTrafficData();
    ROADS.forEach(road => {
      const ratio = calculateCongestion(state.travelTimes[road], NORMAL_TRAVEL_TIME[road]);
      state.congestion[road] = Math.min(ratio, 3.0); // cap at 3x
    });
    // Determine priority order (highest congestion first)
    state.priorityOrder = [...ROADS].sort((a, b) => state.congestion[b] - state.congestion[a]);
  }

  // Calculate green duration based on congestion
  function calculateGreenDuration(road) {
    const ratio = state.congestion[road];
    const duration = BASE_GREEN + (ratio - 1) * 25;
    return Math.round(Math.max(BASE_GREEN, Math.min(MAX_GREEN, duration)));
  }

  // Set signal state for a road
  function setSignal(road, signal) {
    state.signals[road] = signal;
  }

  // Give green to a specific road, red to others
  function giveGreen(road) {
    ROADS.forEach(r => setSignal(r, r === road ? 'green' : 'red'));
    state.currentGreen = road;
    state.greenDurations[road] = calculateGreenDuration(road);
    state.timer = state.greenDurations[road];
    state.phase = 'green';
    state.totalGreenTime[road] += state.greenDurations[road];

    // Log history
    state.history.push({
      time: new Date().toLocaleTimeString(),
      road: road,
      signal: 'green',
      duration: state.greenDurations[road],
      congestion: state.congestion[road].toFixed(2)
    });
    // Keep last 50 entries
    if (state.history.length > 50) state.history.shift();
  }

  // Start yellow transition
  function startYellow() {
    if (state.currentGreen) {
      setSignal(state.currentGreen, 'yellow');
      state.phase = 'yellow';
      state.timer = YELLOW_DURATION;
    }
  }

  // Emergency override
  function activateEmergency(road) {
    state.emergency = { active: true, road };
    ROADS.forEach(r => setSignal(r, r === road ? 'green' : 'red'));
    state.currentGreen = road;
    state.phase = 'green';
    state.timer = 30; // emergency green duration

    state.history.push({
      time: new Date().toLocaleTimeString(),
      road: road,
      signal: '🚨 EMERGENCY',
      duration: 30,
      congestion: state.congestion[road].toFixed(2)
    });
  }

  function deactivateEmergency() {
    state.emergency = { active: false, road: null };
  }

  // Tick the controller (called each simulation second)
  function tick() {
    if (state.phase === 'idle') {
      updateCongestion();
      giveGreen(state.priorityOrder[0]);
      state.cycleIndex = 0;
      return 'start';
    }

    state.timer--;

    if (state.emergency.active) {
      if (state.timer <= 0) {
        state.timer = 30; // keep going until deactivated
      }
      return 'emergency';
    }

    if (state.phase === 'green' && state.timer <= 0) {
      startYellow();
      return 'yellow';
    }

    if (state.phase === 'yellow' && state.timer <= 0) {
      // Move to next road in priority
      state.cycleIndex = (state.cycleIndex + 1) % ROADS.length;
      // Refresh congestion data every full cycle
      if (state.cycleIndex === 0) updateCongestion();
      giveGreen(state.priorityOrder[state.cycleIndex]);
      return 'switch';
    }

    return 'tick';
  }

  // Get congestion level category
  function getCongestionLevel(road) {
    const r = state.congestion[road];
    if (r < 1.2) return 'low';
    if (r < 1.8) return 'medium';
    return 'high';
  }

  // Get congestion as percentage (0-100)
  function getCongestionPercent(road) {
    return Math.min(100, Math.round(((state.congestion[road] - 1) / 2) * 100));
  }

  return {
    state, ROADS, tick, updateCongestion, giveGreen,
    activateEmergency, deactivateEmergency,
    getCongestionLevel, getCongestionPercent,
    calculateGreenDuration
  };
})();
