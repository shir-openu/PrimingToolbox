/**
 * =====================================================
 * PrimingToolbox - Core Module
 * =====================================================
 *
 * Central module for the PrimingToolbox platform.
 * Provides Supabase database connectivity, utility functions,
 * data storage operations, and UI helpers.
 *
 * @module PTA
 * @version 1.0
 * @author Dr. Shir Sivroni, The Open University of Israel
 *
 * Dependencies:
 * - Supabase JS Client (loaded via CDN)
 * - SheetJS (optional, for Excel export)
 *
 * Usage:
 * 1. Include this script after Supabase SDK
 * 2. Call PTA.initSupabase() to connect to database
 * 3. Use PTA.saveTrialResult() or PTA.saveAllResults() for data
 * =====================================================
 */

const PTA = window.PTA || {};

/**
 * Global configuration object.
 * Contains Supabase credentials and version info.
 * @type {Object}
 */
PTA.config = {
  supabaseUrl: 'https://luhgdmzksitdkbysdfbr.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1aGdkbXprc2l0ZGtieXNkZmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjU0MDMsImV4cCI6MjA4MDEwMTQwM30.kxiMmJE4N5U5pM-3d81URKCwZ5PSsE-19AIr5KWOMlQ',
  version: '1.0'
};

/**
 * Supabase client instance.
 * Initialized by calling PTA.initSupabase().
 * @type {Object|null}
 */
PTA.supabase = null;

/**
 * Initialize connection to Supabase database.
 * Must be called after Supabase SDK is loaded.
 * @returns {boolean} True if initialization successful, false otherwise
 */
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

/**
 * Generate unique participant ID.
 * Format: p_{timestamp}_{random9chars}
 * @returns {string} Unique participant identifier
 */
PTA.generateParticipantId = function() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Parse URL query parameters into an object.
 * @returns {Object} Key-value pairs of URL parameters
 */
PTA.getUrlParams = function() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
};

/**
 * Decode Base64-encoded experiment configuration.
 * Used to parse experiment parameters from shared URL.
 * @param {string} encodedConfig - Base64 encoded JSON string
 * @returns {Object|null} Parsed configuration object, or null on failure
 */
PTA.decodeConfig = function(encodedConfig) {
  try {
    const decoded = atob(encodedConfig);
    return JSON.parse(decoded);
  } catch (e) {
    console.error('PTA: Failed to decode config', e);
    return null;
  }
};

/**
 * Encode experiment configuration to Base64 for URL sharing.
 * @param {Object} config - Experiment configuration object
 * @returns {string|null} Base64 encoded string, or null on failure
 */
PTA.encodeConfig = function(config) {
  try {
    const json = JSON.stringify(config);
    return btoa(json);
  } catch (e) {
    console.error('PTA: Failed to encode config', e);
    return null;
  }
};

/**
 * Format date for human-readable display.
 * @param {Date|string} date - Date object or parseable date string
 * @returns {string} Formatted date string (e.g., "Jan 15, 2025, 10:30 AM")
 */
PTA.formatDate = function(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Shuffle array using Fisher-Yates algorithm.
 * Returns a new shuffled array; does not modify original.
 * @param {Array} array - Array to shuffle
 * @returns {Array} New shuffled array
 */
PTA.shuffleArray = function(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Calculate arithmetic mean of numeric array.
 * @param {number[]} arr - Array of numbers
 * @returns {number} Mean value, or 0 for empty array
 */
PTA.mean = function(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

/**
 * Calculate population standard deviation.
 * @param {number[]} arr - Array of numbers
 * @returns {number} Standard deviation, or 0 for empty array
 */
PTA.std = function(arr) {
  if (arr.length === 0) return 0;
  const avg = PTA.mean(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(PTA.mean(squareDiffs));
};

/**
 * Calculate median of numeric array.
 * @param {number[]} arr - Array of numbers
 * @returns {number} Median value, or 0 for empty array
 */
PTA.median = function(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/* =====================================================
   Data Storage Functions
   ===================================================== */

/**
 * Save single trial result to Supabase database.
 * @async
 * @param {string} tableName - Target database table name
 * @param {Object} trialData - Trial data object to insert
 * @returns {Promise<Object>} Result with data or error property
 */
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

/**
 * Save multiple trial results to Supabase in batch.
 * More efficient than saving trials individually.
 * @async
 * @param {string} tableName - Target database table name
 * @param {Object[]} trialsData - Array of trial data objects
 * @returns {Promise<Object>} Result with data or error property
 */
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

/**
 * Fetch experiment data for a specific experimenter.
 * Retrieves all trials matching experimenter email and experiment ID.
 * @async
 * @param {string} tableName - Source database table name
 * @param {string} experimenterEmail - Experimenter's email address
 * @param {string} experimentId - User-defined experiment identifier
 * @returns {Promise<Object>} Result with data array or error property
 */
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

/**
 * Check if participant with external ID already completed experiment.
 * Used to prevent duplicate participation.
 * @async
 * @param {string} tableName - Database table to check
 * @param {string} experimentId - Experiment identifier
 * @param {string} externalId - External participant ID (e.g., Prolific ID)
 * @returns {Promise<Object>} Result with isDuplicate boolean or error
 */
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

/**
 * Export data array to CSV file and trigger download.
 * Handles escaping of commas and quotes in values.
 * @param {Object[]} data - Array of data objects to export
 * @param {string} [filename='experiment_data.csv'] - Download filename
 */
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

/**
 * Export data array to Excel file and trigger download.
 * Requires SheetJS (XLSX) library to be loaded.
 * @param {Object[]} data - Array of data objects to export
 * @param {string} [filename='experiment_data.xlsx'] - Download filename
 */
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

/**
 * Show a DOM element by removing 'hidden' class.
 * @param {HTMLElement|string} element - Element or element ID
 */
PTA.show = function(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.remove('hidden');
    element.style.display = '';
  }
};

/**
 * Hide a DOM element by adding 'hidden' class.
 * @param {HTMLElement|string} element - Element or element ID
 */
PTA.hide = function(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.add('hidden');
  }
};

/**
 * Show overlay element by adding 'active' class.
 * @param {string} overlayId - ID of overlay element
 */
PTA.showOverlay = function(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.add('active');
  }
};

/**
 * Hide overlay element by removing 'active' class.
 * @param {string} overlayId - ID of overlay element
 */
PTA.hideOverlay = function(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.remove('active');
  }
};

/**
 * Display status message in container element.
 * @param {HTMLElement|string} container - Container element or ID
 * @param {string} message - Message text to display
 * @param {string} [type='success'] - Message type ('success' or 'error')
 */
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
