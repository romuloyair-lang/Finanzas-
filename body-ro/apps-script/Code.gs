/**
 * Body RO Tracker API for Google Sheets.
 * Deploy as: Apps Script > Deploy > New deployment > Web app.
 * Execute as: Me. Access: Anyone with the link.
 */
const SHEET_NAME = 'ROS';
const API_KEY = 'CHANGE_ME_PRIVATE_KEY';

const HEADERS = [
  'ro_number',
  'vehicle',
  'damage_area',
  'status',
  'assembly_hold',
  'body_hours_estimated',
  'body_hours_week',
  'notes',
  'technician_reply',
  'transcription_text',
  'source',
  'is_finished',
  'delivered_at',
  'checklist_done',
  'materials_json',
  'history_json',
  'created_at',
  'updated_at'
];

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = params.callback || '';
  try {
    requireKey_(params.apiKey || params.key);
    const action = params.action || 'list';
    if (action === 'list') return json_({ ok: true, ros: listRos_() }, callback);
    return json_({ ok: false, error: 'Unsupported GET action: ' + action }, callback);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) }, callback);
  }
}

function doPost(e) {
  try {
    const bodyText = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(bodyText);
    requireKey_(body.apiKey || body.key);
    const action = body.action || 'upsert_ro';

    if (action === 'upsert_ro') {
      const ro = normalizeRo_(body.data || body.ro || body);
      upsertRo_(ro);
      return json_({ ok: true, ro_number: ro.ro_number, updated_at: ro.updated_at });
    }

    if (action === 'save_all') {
      const all = [];
      (body.active || []).forEach(function (r) { all.push(normalizeRo_(r, false)); });
      (body.done || []).forEach(function (r) { all.push(normalizeRo_(r, true)); });
      all.forEach(upsertRo_);
      return json_({ ok: true, count: all.length });
    }

    return json_({ ok: false, error: 'Unsupported POST action: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function requireKey_(key) {
  if (!API_KEY || API_KEY === 'CHANGE_ME_PRIVATE_KEY') {
    throw new Error('Configure API_KEY in Apps Script first.');
  }
  if (String(key || '') !== API_KEY) throw new Error('Invalid API key.');
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  ensureHeaders_(sh);
  return sh;
}

function ensureHeaders_(sh) {
  const current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), HEADERS.length)).getValues()[0];
  let needs = false;
  for (let i = 0; i < HEADERS.length; i++) {
    if (current[i] !== HEADERS[i]) { needs = true; break; }
  }
  if (needs) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
}

function listRos_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return values.filter(function (row) { return row[0]; }).map(function (row) {
    const obj = {};
    HEADERS.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function upsertRo_(ro) {
  if (!ro.ro_number) throw new Error('Missing ro_number.');
  const sh = sheet_();
  const now = new Date().toISOString();
  const existing = findRowByRo_(sh, ro.ro_number);
  const createdAt = existing.rowIndex ? existing.values[HEADERS.indexOf('created_at')] || now : now;
  ro.created_at = ro.created_at || createdAt;
  ro.updated_at = now;
  const row = HEADERS.map(function (h) { return ro[h] !== undefined ? ro[h] : ''; });
  if (existing.rowIndex) sh.getRange(existing.rowIndex, 1, 1, HEADERS.length).setValues([row]);
  else sh.appendRow(row);
}

function findRowByRo_(sh, roNumber) {
  const last = sh.getLastRow();
  if (last < 2) return { rowIndex: 0, values: null };
  const values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(roNumber)) return { rowIndex: i + 2, values: values[i] };
  }
  return { rowIndex: 0, values: null };
}

function normalizeRo_(input, forceFinished) {
  input = input || {};
  const finished = forceFinished === true || input.is_finished === true || input.finished === true || input.status === 'entregado';
  const status = input.status || input.current_status || (finished ? 'entregado' : 'revision');
  const ro = {
    ro_number: String(input.ro_number || input.ro || '').trim(),
    vehicle: input.vehicle || input.vehiculo || '',
    damage_area: input.damage_area || input.area || '',
    status: status,
    assembly_hold: status === 'armado' ? (input.assembly_hold || input.armadoWait || '') : '',
    body_hours_estimated: Number(input.body_hours_estimated || input.estimated_hours || input.est || 0),
    body_hours_week: Number(input.body_hours_week || input.week || 0),
    notes: input.notes || input.notas || '',
    technician_reply: input.technician_reply || input.technicianReply || input.techReply || '',
    transcription_text: input.transcription_text || input.transcription || input.raw_text || '',
    source: input.source || 'gpt_photo',
    is_finished: finished ? 'TRUE' : 'FALSE',
    delivered_at: input.delivered_at || input.deliveredAt || '',
    checklist_done: JSON.stringify(input.checklist_done || input.checks || [1, 0, 0, 0, 0, 0]),
    materials_json: JSON.stringify(input.materials_json || input.materials || []),
    history_json: JSON.stringify(input.history_json || input.history || ['RO actualizado por GPT']),
    created_at: input.created_at || '',
    updated_at: input.updated_at || ''
  };
  if (!ro.ro_number) throw new Error('Missing ro_number.');
  if (finished) {
    ro.status = 'entregado';
    ro.assembly_hold = '';
    if (!ro.delivered_at) ro.delivered_at = new Date().toISOString().slice(0, 10);
  }
  return ro;
}

function json_(obj, callback) {
  const text = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(String(callback).replace(/[^\w.$]/g, '') + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
