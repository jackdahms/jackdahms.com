// ─── Config ──────────────────────────────────────────────────────────────────

const EBIRD_BASE = 'https://api.ebird.org/v2';
const LS_KEY_APIKEY = 'birdreport_apikey';
const LS_KEY_REGION = 'birdreport_region';
const LS_KEY_HOURS  = 'birdreport_hours';

// ─── State ───────────────────────────────────────────────────────────────────

let allEnrichedObs = [];
let currentFilter  = 'notable';
let currentView    = 'map';
let leafletMap     = null;
let markerLayer    = null;
let regionBounds   = null;

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchObs(apiKey, region, backDays, notable = false) {
  const endpoint = notable
    ? `${EBIRD_BASE}/data/obs/${region}/recent/notable`
    : `${EBIRD_BASE}/data/obs/${region}/recent`;

  const url = `${endpoint}?back=${backDays}&detail=full`;
  const res = await fetch(url, {
    headers: { 'X-eBirdApiToken': apiKey }
  });

  if (res.status === 403) throw new Error('Invalid API key (403). Check your eBird API key.');
  if (res.status === 404) throw new Error(`Region not found (404). Check the region code "${region}".`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

  return res.json();
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseLifeList(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return new Set();

  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // eBird's MyEBirdData.csv uses "Common Name"; fall back to "Species Code" if present
  const nameIdx = header.findIndex(h => h === 'Common Name');
  const codeIdx = header.findIndex(h => h === 'Species Code');
  const idx = nameIdx !== -1 ? nameIdx : codeIdx;
  if (idx === -1) return new Set();

  const names = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols[idx]) {
      names.add(cols[idx].trim().replace(/^"|"$/g, '').toLowerCase());
    }
  }
  return names;
}

// ─── Time Helpers ─────────────────────────────────────────────────────────────

function parseObsDate(obsDt) {
  // eBird format: "2024-05-01 14:32" (local time, no TZ info)
  // Treat as local time by replacing space with T
  return new Date(obsDt.replace(' ', 'T'));
}

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

function enrichObs(allObs, notableSet, lifeListSet, cutoff) {
  return allObs
    .filter(obs => {
      const d = parseObsDate(obs.obsDt);
      return !isNaN(d.getTime()) && d >= cutoff;
    })
    .map(obs => ({
      ...obs,
      isRare: notableSet.has(obs.speciesCode),
      isNew:  lifeListSet.size > 0 && !lifeListSet.has(obs.comName.toLowerCase()),
      _date:  parseObsDate(obs.obsDt)
    }))
    .sort((a, b) => b._date - a._date);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function applyFilter(obs, filter) {
  if (filter === 'rare')    return obs.filter(o => o.isRare);
  if (filter === 'new')     return obs.filter(o => o.isNew);
  if (filter === 'notable') return obs.filter(o => o.isRare || o.isNew);
  return obs;
}

function renderCard(obs) {
  const badges = [];
  if (obs.isNew)  badges.push('<span class="badge badge-new">New For You</span>');
  if (obs.isRare) badges.push('<span class="badge badge-rare">Rare</span>');

  const count = obs.howMany ? `${obs.howMany} bird${obs.howMany !== 1 ? 's' : ''}` : 'present';
  const location = obs.locationPrivate ? 'Private Location' : (obs.locName || 'Unknown location');
  const timeStr = timeAgo(obs._date);
  const checklistLink = obs.subId
    ? `<a class="checklist-link" href="https://ebird.org/checklist/${obs.subId}" target="_blank">View checklist →</a>`
    : '';

  const cardClass = ['obs-card', obs.isNew ? 'card-new' : '', obs.isRare ? 'card-rare' : ''].filter(Boolean).join(' ');

  return `
    <div class="${cardClass}">
      <div class="card-badges">${badges.join('')}</div>
      <div class="card-body">
        <div class="card-name">
          <span class="common-name">${obs.comName}</span>
          <span class="sci-name">${obs.sciName}</span>
        </div>
        <div class="card-meta">
          <span class="meta-count">${count}</span>
          <span class="meta-sep">·</span>
          <span class="meta-location">${location}</span>
          <span class="meta-sep">·</span>
          <span class="meta-time">${timeStr}</span>
          ${checklistLink}
        </div>
      </div>
    </div>`;
}

function renderResults(filter) {
  const resultsEl = document.getElementById('results');
  const visible = applyFilter(allEnrichedObs, filter);

  if (visible.length === 0) {
    resultsEl.innerHTML = '<p class="empty-state">No observations match this filter.</p>';
  } else {
    resultsEl.innerHTML = visible.map(renderCard).join('');
  }

  if (currentView === 'map') renderMap(filter);
}

// ─── Map ──────────────────────────────────────────────────────────────────────

function markerColor(obs) {
  if (obs.isNew && obs.isRare) return '#2d7d32'; // dark green
  if (obs.isNew)  return '#4a7c2f';              // green
  if (obs.isRare) return '#c97d10';              // amber
  return '#6b7280';                              // grey
}

function makeMarkerIcon(obs) {
  const color = markerColor(obs);
  const size = (obs.isNew || obs.isRare) ? 14 : 10;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function popupHtml(obs) {
  const badges = [];
  if (obs.isNew)  badges.push('<span class="badge badge-new">New For You</span>');
  if (obs.isRare) badges.push('<span class="badge badge-rare">Rare</span>');
  const count = obs.howMany ? `${obs.howMany} bird${obs.howMany !== 1 ? 's' : ''}` : 'present';
  const location = obs.locationPrivate ? 'Private Location' : (obs.locName || '');
  const checklistLink = obs.subId
    ? `<a href="https://ebird.org/checklist/${obs.subId}" target="_blank">View checklist →</a>`
    : '';
  return `
    <div class="map-popup">
      <div class="popup-badges">${badges.join(' ')}</div>
      <div class="popup-name">${obs.comName}</div>
      <div class="popup-sci">${obs.sciName}</div>
      <div class="popup-meta">${count} · ${timeAgo(obs._date)}</div>
      ${location ? `<div class="popup-meta">${location}</div>` : ''}
      ${checklistLink ? `<div class="popup-link">${checklistLink}</div>` : ''}
    </div>`;
}

function initMap() {
  if (leafletMap) return;
  leafletMap = L.map('map').setView([43.07, -89.4], 10);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(leafletMap);
  markerLayer = L.layerGroup().addTo(leafletMap);
}

function renderMap(filter) {
  initMap();
  markerLayer.clearLayers();

  const visible = applyFilter(allEnrichedObs, filter).filter(o => o.lat && o.lng);

  visible.forEach(obs => {
    L.marker([obs.lat, obs.lng], { icon: makeMarkerIcon(obs) })
      .bindPopup(popupHtml(obs), { maxWidth: 260 })
      .addTo(markerLayer);
  });

  if (regionBounds) {
    const { minY, maxY, minX, maxX } = regionBounds;
    const bounds = L.latLngBounds([[minY, minX], [maxY, maxX]]);
    visible.forEach(o => bounds.extend([o.lat, o.lng]));
    leafletMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
  } else if (visible.length > 0) {
    const bounds = L.latLngBounds(visible.map(o => [o.lat, o.lng]));
    leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }

  // Invalidate size in case the container was hidden when initialized
  setTimeout(() => leafletMap.invalidateSize(), 50);
}

function setView(view) {
  currentView = view;
  const listEl = document.getElementById('results');
  const mapEl  = document.getElementById('map');
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

  if (view === 'map') {
    listEl.hidden = true;
    mapEl.hidden  = false;
    renderMap(currentFilter);
  } else {
    listEl.hidden = false;
    mapEl.hidden  = true;
  }
}

function renderStats(obs) {
  const rare  = obs.filter(o => o.isRare).length;
  const isNew = obs.filter(o => o.isNew).length;
  const lifeLoaded = obs.length > 0 && obs[0].isNew !== undefined && allEnrichedObs.some(o => o.isNew !== undefined);

  let txt = `<strong>${obs.length}</strong> observation${obs.length !== 1 ? 's' : ''}`;
  if (rare)    txt += ` &nbsp;·&nbsp; <span class="stat-rare">${rare} rare</span>`;
  if (isNew)   txt += ` &nbsp;·&nbsp; <span class="stat-new">${isNew} new for you</span>`;
  if (!lifeLoaded && rare === 0 && isNew === 0) txt += ' &nbsp;·&nbsp; <span class="stat-hint">(upload life list CSV to see new species)</span>';

  document.getElementById('stats-bar').innerHTML = txt;
}

// ─── Status / Error ───────────────────────────────────────────────────────────

function showStatus(msg, type = 'info') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = `status-message status-${type}`;
  el.hidden = false;
}

function hideStatus() {
  document.getElementById('status').hidden = true;
}

function setLoading(loading) {
  const btn = document.getElementById('run-btn');
  btn.disabled = loading;
  btn.textContent = loading ? 'Loading…' : 'Run Report';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runReport() {
  const apiKey = document.getElementById('api-key').value.trim();
  const region = document.getElementById('region').value.trim();
  const hoursRaw = parseInt(document.getElementById('hours').value, 10);
  const fileInput = document.getElementById('lifelist');

  if (!apiKey) { showStatus('Please enter your eBird API key.', 'error'); return; }
  if (!region) { showStatus('Please enter a region code.', 'error'); return; }
  if (!hoursRaw || hoursRaw < 1) { showStatus('Lookback must be at least 1 hour.', 'error'); return; }

  const hours   = Math.min(hoursRaw, 720);
  const backDays = Math.min(Math.ceil(hours / 24), 30);
  const cutoff  = new Date(Date.now() - hours * 3600 * 1000);

  // Persist settings
  localStorage.setItem(LS_KEY_APIKEY, apiKey);
  localStorage.setItem(LS_KEY_REGION, region);
  localStorage.setItem(LS_KEY_HOURS,  hours);

  setLoading(true);
  hideStatus();
  document.getElementById('results-section').hidden = true;

  try {
    // Parse life list if provided
    let lifeListSet = new Set();
    if (fileInput.files.length > 0) {
      const csvText = await fileInput.files[0].text();
      lifeListSet = parseLifeList(csvText);
      if (lifeListSet.size === 0) {
        showStatus('Life list CSV loaded but no species codes found. Make sure it\'s the unmodified MyEBirdData.csv.', 'warn');
      }
    }

    // Parallel API calls
    const [allObs, notableObs, regionInfo] = await Promise.all([
      fetchObs(apiKey, region, backDays, false),
      fetchObs(apiKey, region, backDays, true),
      fetch(`${EBIRD_BASE}/ref/region/info/${region}`, { headers: { 'X-eBirdApiToken': apiKey } }).then(r => r.json()).catch(() => null)
    ]);

    regionBounds = regionInfo?.bounds ?? null;
    const notableSet = new Set(notableObs.map(o => o.speciesCode));

    allEnrichedObs = enrichObs(allObs, notableSet, lifeListSet, cutoff);

    renderStats(allEnrichedObs);
    renderResults(currentFilter);

    document.getElementById('results-section').hidden = false;
    hideStatus();
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Restore saved settings
  const savedKey    = localStorage.getItem(LS_KEY_APIKEY);
  const savedRegion = localStorage.getItem(LS_KEY_REGION);
  const savedHours  = localStorage.getItem(LS_KEY_HOURS);
  if (savedKey)    document.getElementById('api-key').value = savedKey;
  if (savedRegion) document.getElementById('region').value  = savedRegion;
  if (savedHours)  document.getElementById('hours').value   = savedHours;

  // Run button
  document.getElementById('run-btn').addEventListener('click', runReport);

  // Allow Enter key in inputs to trigger run
  document.querySelectorAll('.settings-panel input').forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') runReport(); });
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderResults(currentFilter);
    });
  });

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  // File name display
  document.getElementById('lifelist').addEventListener('change', e => {
    const name = e.target.files[0]?.name || 'Choose MyEBirdData.csv';
    document.getElementById('file-name').textContent = name;
  });
});
