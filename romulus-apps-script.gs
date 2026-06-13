/**
 * Romulus Detailing backend for Google Sheets + Google Calendar.
 * Paste this file into Google Apps Script.
 *
 * Setup:
 * 1) Create a Google Sheet named "Romulus Detailing CRM".
 * 2) Copy the Sheet ID from the URL and paste it below.
 * 3) In Apps Script: Project Settings > Script Properties:
 *    ADMIN_TOKEN = any long private password/token you choose.
 * 4) Run setupSheets() once.
 * 5) Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone with the link
 * 6) Paste the Web App URL into romulus-admin.html settings.
 */

const SHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const CALENDAR_ID = 'primary';

const SHEETS = {
  REQUESTS: 'Requests',
  CUSTOMERS: 'Customers',
  APPOINTMENTS: 'Appointments'
};

const HEADERS = {
  Requests: [
    'Request ID','Created At','Status','Customer Name','Phone','Email','Vehicle','Service','Vehicle Type',
    'Estimated Total','Extras','Notes','Preferred Date','Preferred Time','Second Date','Second Time',
    'Location Type','Address','FAQ Accepted','SMS Text','Calendar Event ID','Admin Notes','Updated At'
  ],
  Customers: [
    'Customer ID','Created At','Name','Phone','Email','Address','Vehicles','First Visit','Last Visit','Total Jobs','Notes','Updated At'
  ],
  Appointments: [
    'Appointment ID','Request ID','Created At','Customer Name','Phone','Vehicle','Service','Start Time','End Time',
    'Status','Calendar Event ID','Price Confirmed','Deposit Paid','Admin Notes','Updated At'
  ]
};

function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Object.keys(HEADERS).forEach(function(name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, HEADERS[name].length);
  });
}

function doGet(e) {
  try {
    const action = String((e.parameter && e.parameter.action) || 'list');
    const token = String((e.parameter && e.parameter.token) || '');
    requireAdmin(token);

    if (action === 'list') {
      return jsonOut({ ok: true, data: listAll() });
    }

    return jsonOut({ ok: false, error: 'Unknown GET action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    requireAdmin(String(body.token || ''));

    if (body.action === 'createRequest') return jsonOut({ ok: true, requestId: createRequest(body.payload || {}) });
    if (body.action === 'updateStatus') return jsonOut({ ok: true, result: updateStatus(body.payload || {}) });
    if (body.action === 'confirmAppointment') return jsonOut({ ok: true, result: confirmAppointment(body.payload || {}) });
    if (body.action === 'upsertCustomer') return jsonOut({ ok: true, result: upsertCustomer(body.payload || {}) });

    return jsonOut({ ok: false, error: 'Unknown POST action: ' + body.action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function requireAdmin(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || 'CHANGE_ME';
  if (!token || token !== expected) throw new Error('Unauthorized admin token.');
}

function ss() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function sheet(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name + '. Run setupSheets().');
  return sh;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function rowsAsObjects(sheetName) {
  const sh = sheet(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function(row) {
    return row.join('').trim() !== '';
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function listAll() {
  return {
    requests: rowsAsObjects(SHEETS.REQUESTS).reverse(),
    customers: rowsAsObjects(SHEETS.CUSTOMERS).reverse(),
    appointments: rowsAsObjects(SHEETS.APPOINTMENTS).reverse()
  };
}

function createRequest(p) {
  const requestId = p.requestId || id('REQ');
  const createdAt = nowIso();
  sheet(SHEETS.REQUESTS).appendRow([
    requestId,
    createdAt,
    p.status || 'REQUESTED',
    p.customerName || '',
    p.phone || '',
    p.email || '',
    p.vehicle || '',
    p.service || '',
    p.vehicleType || '',
    p.estimatedTotal || '',
    p.extras || '',
    p.notes || '',
    p.preferredDate || '',
    p.preferredTime || '',
    p.secondDate || '',
    p.secondTime || '',
    p.locationType || '',
    p.address || '',
    p.faqAccepted || 'YES',
    p.smsText || '',
    '',
    p.adminNotes || '',
    createdAt
  ]);

  upsertCustomer({
    name: p.customerName || '',
    phone: p.phone || '',
    email: p.email || '',
    address: p.address || '',
    vehicle: p.vehicle || '',
    notes: 'Created from request ' + requestId
  });

  return requestId;
}

function findRowById(sheetName, idColumnName, value) {
  const sh = sheet(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idx = headers.indexOf(idColumnName);
  if (idx === -1) throw new Error('Missing column: ' + idColumnName);
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idx]) === String(value)) return { sheet: sh, row: r + 1, headers: headers, values: values[r] };
  }
  throw new Error('Not found: ' + value);
}

function setByHeader(rowInfo, header, value) {
  const idx = rowInfo.headers.indexOf(header);
  if (idx === -1) throw new Error('Missing column: ' + header);
  rowInfo.sheet.getRange(rowInfo.row, idx + 1).setValue(value);
}

function updateStatus(p) {
  const requestId = p.requestId;
  if (!requestId) throw new Error('requestId is required.');
  const row = findRowById(SHEETS.REQUESTS, 'Request ID', requestId);
  setByHeader(row, 'Status', p.status || 'REVIEWED');
  if (p.adminNotes !== undefined) setByHeader(row, 'Admin Notes', p.adminNotes || '');
  setByHeader(row, 'Updated At', nowIso());
  return { requestId: requestId, status: p.status || 'REVIEWED' };
}

function confirmAppointment(p) {
  const requestId = p.requestId;
  if (!requestId) throw new Error('requestId is required.');
  if (!p.startTime || !p.endTime) throw new Error('startTime and endTime are required.');

  const row = findRowById(SHEETS.REQUESTS, 'Request ID', requestId);
  const obj = {};
  row.headers.forEach(function(h, i) { obj[h] = row.values[i]; });

  const start = new Date(p.startTime);
  const end = new Date(p.endTime);
  const title = 'Romulus Detailing - ' + (obj['Customer Name'] || 'Customer') + ' - ' + (obj['Vehicle'] || 'Vehicle');
  const description = [
    'Request ID: ' + requestId,
    'Status: CONFIRMED',
    'Customer: ' + (obj['Customer Name'] || ''),
    'Phone: ' + (obj.Phone || ''),
    'Email: ' + (obj.Email || ''),
    'Vehicle: ' + (obj.Vehicle || ''),
    'Service: ' + (obj.Service || ''),
    'Vehicle Type: ' + (obj['Vehicle Type'] || ''),
    'Estimated Total: ' + (obj['Estimated Total'] || ''),
    'Confirmed Price: ' + (p.priceConfirmed || ''),
    'Extras: ' + (obj.Extras || ''),
    'Notes: ' + (obj.Notes || ''),
    'Admin Notes: ' + (p.adminNotes || obj['Admin Notes'] || '')
  ].join('\n');

  const event = CalendarApp.getCalendarById(CALENDAR_ID).createEvent(title, start, end, {
    description: description,
    location: p.address || obj.Address || ''
  });

  const eventId = event.getId();
  setByHeader(row, 'Status', 'CONFIRMED');
  setByHeader(row, 'Calendar Event ID', eventId);
  setByHeader(row, 'Admin Notes', p.adminNotes || obj['Admin Notes'] || '');
  setByHeader(row, 'Updated At', nowIso());

  sheet(SHEETS.APPOINTMENTS).appendRow([
    id('APT'),
    requestId,
    nowIso(),
    obj['Customer Name'] || '',
    obj.Phone || '',
    obj.Vehicle || '',
    obj.Service || '',
    start.toISOString(),
    end.toISOString(),
    'CONFIRMED',
    eventId,
    p.priceConfirmed || '',
    p.depositPaid || '',
    p.adminNotes || '',
    nowIso()
  ]);

  return { requestId: requestId, calendarEventId: eventId, status: 'CONFIRMED' };
}

function upsertCustomer(p) {
  const phone = String(p.phone || '').trim();
  const email = String(p.email || '').trim();
  const name = String(p.name || '').trim();
  if (!phone && !email && !name) return { skipped: true };

  const sh = sheet(SHEETS.CUSTOMERS);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const phoneIdx = headers.indexOf('Phone');
  const emailIdx = headers.indexOf('Email');

  for (let r = 1; r < values.length; r++) {
    const samePhone = phone && String(values[r][phoneIdx]).trim() === phone;
    const sameEmail = email && String(values[r][emailIdx]).trim() === email;
    if (samePhone || sameEmail) {
      const row = { sheet: sh, row: r + 1, headers: headers, values: values[r] };
      if (p.vehicle) setByHeader(row, 'Vehicles', mergeText(values[r][headers.indexOf('Vehicles')], p.vehicle));
      if (p.address) setByHeader(row, 'Address', p.address);
      if (p.notes) setByHeader(row, 'Notes', mergeText(values[r][headers.indexOf('Notes')], p.notes));
      setByHeader(row, 'Updated At', nowIso());
      return { updated: true };
    }
  }

  sh.appendRow([
    id('CUS'),
    nowIso(),
    name,
    phone,
    email,
    p.address || '',
    p.vehicle || '',
    '',
    '',
    0,
    p.notes || '',
    nowIso()
  ]);
  return { created: true };
}

function mergeText(oldValue, newValue) {
  oldValue = String(oldValue || '').trim();
  newValue = String(newValue || '').trim();
  if (!newValue) return oldValue;
  if (!oldValue) return newValue;
  if (oldValue.indexOf(newValue) !== -1) return oldValue;
  return oldValue + ' | ' + newValue;
}
