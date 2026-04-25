// ===== VISUALIZATION DASHBOARD =====
// Chart.js graphs and data table for traffic analytics

document.addEventListener('DOMContentLoaded', () => {
  const ROADS = ['North', 'South', 'East', 'West'];
  const ROAD_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f97316'];

  let congestionChart, historyChart, signalDistChart;
  let historyData = { labels: [], datasets: [] };
  let updateInterval = null;
  let isLive = false;

  // Chart.js global defaults for dark/light theme
  function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: isDark ? '#aaa' : '#555',
      grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      bg: isDark ? '#1a1a2e' : '#ffffff'
    };
  }

  function initCharts() {
    const colors = getChartColors();

    // Bar chart - current congestion
    congestionChart = new Chart(document.getElementById('chart-congestion'), {
      type: 'bar',
      data: {
        labels: ROADS,
        datasets: [{
          label: 'Congestion Ratio',
          data: [1, 1, 1, 1],
          backgroundColor: ROAD_COLORS.map(c => c + '80'),
          borderColor: ROAD_COLORS,
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true, max: 3,
            title: { display: true, text: 'Congestion Ratio (x)', color: colors.text },
            ticks: { color: colors.text },
            grid: { color: colors.grid }
          },
          x: {
            ticks: { color: colors.text },
            grid: { display: false }
          }
        }
      }
    });

    // Line chart - history
    historyData = {
      labels: [],
      datasets: ROADS.map((r, i) => ({
        label: r,
        data: [],
        borderColor: ROAD_COLORS[i],
        backgroundColor: ROAD_COLORS[i] + '20',
        tension: 0.4,
        fill: true,
        pointRadius: 2
      }))
    };

    historyChart = new Chart(document.getElementById('chart-history'), {
      type: 'line',
      data: historyData,
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: colors.text, usePointStyle: true, pointStyle: 'circle' } }
        },
        scales: {
          y: {
            beginAtZero: true, max: 3,
            title: { display: true, text: 'Congestion', color: colors.text },
            ticks: { color: colors.text },
            grid: { color: colors.grid }
          },
          x: {
            ticks: { color: colors.text, maxTicksLimit: 10 },
            grid: { display: false }
          }
        }
      }
    });

    // Doughnut - signal time distribution
    signalDistChart = new Chart(document.getElementById('chart-signal-dist'), {
      type: 'doughnut',
      data: {
        labels: ROADS,
        datasets: [{
          data: [25, 25, 25, 25],
          backgroundColor: ROAD_COLORS,
          borderWidth: 0,
          spacing: 4,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        cutout: '60%',
        plugins: {
          legend: { labels: { color: colors.text, usePointStyle: true, pointStyle: 'circle' } }
        }
      }
    });
  }

  // Generate simulated data if no simulation is running
  function generateSimData() {
    return {
      congestion: {
        north: 1 + Math.random() * 1.5,
        south: 1 + Math.random() * 1.5,
        east: 1 + Math.random() * 1.5,
        west: 1 + Math.random() * 1.5
      },
      totalGreenTime: {
        north: 20 + Math.random() * 40,
        south: 20 + Math.random() * 40,
        east: 20 + Math.random() * 40,
        west: 20 + Math.random() * 40
      },
      history: [],
      signals: { north: 'red', south: 'red', east: 'green', west: 'red' }
    };
  }

  function fetchData() {
    try {
      const stored = localStorage.getItem('trafficState');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if data is recent (within 30 seconds)
        if (Date.now() - parsed.timestamp < 30000) return parsed;
      }
    } catch (e) { /* ignore */ }
    return generateSimData();
  }

  function updateCharts() {
    const data = fetchData();
    const congestion = data.congestion;
    const roads = ['north', 'south', 'east', 'west'];

    // Update bar chart
    congestionChart.data.datasets[0].data = roads.map(r => +congestion[r].toFixed(2));
    congestionChart.update('none');

    // Update history
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    historyData.labels.push(now);
    roads.forEach((r, i) => historyData.datasets[i].data.push(+congestion[r].toFixed(2)));
    // Keep last 20 points
    if (historyData.labels.length > 20) {
      historyData.labels.shift();
      historyData.datasets.forEach(d => d.data.shift());
    }
    historyChart.update('none');

    // Update doughnut
    const gt = data.totalGreenTime;
    const total = roads.reduce((s, r) => s + (gt[r] || 1), 0);
    signalDistChart.data.datasets[0].data = roads.map(r => +((gt[r] || 1) / total * 100).toFixed(1));
    signalDistChart.update('none');

    // Update table from history
    if (data.history && data.history.length) {
      const tbody = document.getElementById('timing-tbody');
      tbody.innerHTML = '';
      const recent = data.history.slice(-15).reverse();
      recent.forEach(h => {
        const signalClass = h.signal.includes('EMERGENCY') ? 'red' :
          h.signal === 'green' ? 'green' : h.signal === 'yellow' ? 'yellow' : 'red';
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${h.time}</td>
          <td style="font-weight:600;">${h.road.charAt(0).toUpperCase() + h.road.slice(1)}</td>
          <td><span class="signal-badge ${signalClass}">${h.signal}</span></td>
          <td>${h.duration}s</td>
          <td>${h.congestion}x</td>`;
        tbody.appendChild(row);
      });
    }
  }

  // Toggle live updates
  const toggleBtn = document.getElementById('viz-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (isLive) {
        clearInterval(updateInterval);
        isLive = false;
        toggleBtn.textContent = '▶ Start Live Updates';
      } else {
        updateCharts();
        updateInterval = setInterval(updateCharts, 3000);
        isLive = true;
        toggleBtn.textContent = '⏸ Stop Live Updates';
      }
    });
  }

  initCharts();
  updateCharts();
});
