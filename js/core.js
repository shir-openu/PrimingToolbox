/* =====================================================
   PrimingToolbox - Core Module
   Version: 1.0
   Supabase connection and utility functions
   ===================================================== */

const PTA = window.PTA || {};

// Supabase configuration
PTA.config = {
  supabaseUrl: 'https://bgbhvvaykmkeoniagfap.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnYmh2dmF5a21rZW9uaWFnZmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI4MTQ5MjAsImV4cCI6MjA0ODM5MDkyMH0.WPMsaUIcBvMqSvMqMWasYcb0iC5cODJhMgR_wjY8Jvw',
  version: '1.0'
};

// Initialize Supabase client
PTA.supabase = null;

PTA.initSupabase = function() {
  if (typeof supabase !== 'undefined') {
    PTA.supabase = supabase.createClient(PTA.config.supabaseUrl, PTA.config.supabaseKey);
    console.log('PTA: Supabase initialized');
    return true;
  } else {
    console.error('PTA: Supabase library not loaded');
    return false;
  }
};

/* =====================================================
   Utility Functions
   ===================================================== */

// Generate unique participant ID
PTA.generateParticipantId = function() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Get URL parameters
PTA.getUrlParams = function() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
};

// Decode experiment config from URL
PTA.decodeConfig = function(encodedConfig) {
  try {
    const decoded = atob(encodedConfig);
    return JSON.parse(decoded);
  } catch (e) {
    console.error('PTA: Failed to decode config', e);
    return null;
  }
};

// Encode experiment config for URL
PTA.encodeConfig = function(config) {
  try {
    const json = JSON.stringify(config);
    return btoa(json);
  } catch (e) {
    console.error('PTA: Failed to encode config', e);
    return null;
  }
};

// Format date for display
PTA.formatDate = function(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Shuffle array (Fisher-Yates)
PTA.shuffleArray = function(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Calculate mean
PTA.mean = function(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

// Calculate standard deviation
PTA.std = function(arr) {
  if (arr.length === 0) return 0;
  const avg = PTA.mean(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(PTA.mean(squareDiffs));
};

// Calculate median
PTA.median = function(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/* =====================================================
   Data Storage Functions
   ===================================================== */

// Save single trial result to Supabase
PTA.saveTrialResult = async function(tableName, trialData) {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized');
    return { error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await PTA.supabase
      .from(tableName)
      .insert([trialData]);

    if (error) {
      console.error('PTA: Error saving trial', error);
      return { error };
    }

    return { data };
  } catch (e) {
    console.error('PTA: Exception saving trial', e);
    return { error: e.message };
  }
};

// Save multiple trial results to Supabase
PTA.saveAllResults = async function(tableName, trialsData) {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized');
    return { error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await PTA.supabase
      .from(tableName)
      .insert(trialsData);

    if (error) {
      console.error('PTA: Error saving results', error);
      return { error };
    }

    console.log('PTA: Saved', trialsData.length, 'trials');
    return { data };
  } catch (e) {
    console.error('PTA: Exception saving results', e);
    return { error: e.message };
  }
};

// Fetch experimenter's data from Supabase
PTA.fetchExperimenterData = async function(tableName, experimenterEmail, experimentId) {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized');
    return { error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await PTA.supabase
      .from(tableName)
      .select('*')
      .eq('experimenter_email', experimenterEmail)
      .eq('user_experiment_id', experimentId);

    if (error) {
      console.error('PTA: Error fetching data', error);
      return { error };
    }

    return { data };
  } catch (e) {
    console.error('PTA: Exception fetching data', e);
    return { error: e.message };
  }
};

// Check if external ID already participated
PTA.checkDuplicateParticipation = async function(tableName, experimentId, externalId) {
  if (!PTA.supabase) {
    console.error('PTA: Supabase not initialized');
    return { error: 'Supabase not initialized' };
  }

  try {
    const { data, error } = await PTA.supabase
      .from(tableName)
      .select('id')
      .eq('user_experiment_id', experimentId)
      .eq('external_id', externalId)
      .limit(1);

    if (error) {
      console.error('PTA: Error checking duplicate', error);
      return { error };
    }

    return { isDuplicate: data && data.length > 0 };
  } catch (e) {
    console.error('PTA: Exception checking duplicate', e);
    return { error: e.message };
  }
};

/* =====================================================
   Export Functions
   ===================================================== */

// Export to CSV
PTA.exportToCSV = function(data, filename) {
  if (!data || data.length === 0) {
    console.warn('PTA: No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      // Escape quotes and wrap in quotes if contains comma
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val ?? '';
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'experiment_data.csv';
  link.click();

  URL.revokeObjectURL(url);
};

// Export to Excel (requires SheetJS)
PTA.exportToExcel = function(data, filename) {
  if (typeof XLSX === 'undefined') {
    console.error('PTA: SheetJS (XLSX) not loaded');
    alert('Excel export requires SheetJS library');
    return;
  }

  if (!data || data.length === 0) {
    console.warn('PTA: No data to export');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

  XLSX.writeFile(workbook, filename || 'experiment_data.xlsx');
};

/* =====================================================
   UI Helper Functions
   ===================================================== */

// Show element
PTA.show = function(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.remove('hidden');
    element.style.display = '';
  }
};

// Hide element
PTA.hide = function(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.add('hidden');
  }
};

// Show overlay
PTA.showOverlay = function(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.add('active');
  }
};

// Hide overlay
PTA.hideOverlay = function(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.remove('active');
  }
};

// Display message
PTA.showMessage = function(container, message, type = 'success') {
  const msgDiv = document.createElement('div');
  msgDiv.className = type + '-message';
  msgDiv.textContent = message;

  if (typeof container === 'string') {
    container = document.getElementById(container);
  }

  if (container) {
    container.innerHTML = '';
    container.appendChild(msgDiv);
  }
};

// Export PTA to global scope
window.PTA = PTA;

console.log('PTA Core v' + PTA.config.version + ' loaded');
