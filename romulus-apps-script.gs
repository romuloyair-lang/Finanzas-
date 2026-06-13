/**
 * Romulus Detailing backend for Google Sheets + Google Calendar.
 *
 * Public actions:
 * - createRequest: customer app creates a request in Sheets.
 * - getStatus: customer checks limited request status with Request ID + phone.
 *
 * Admin-only actions:
 * - list: admin dashboard reads all requests/customers/appointments.
 * - updateStatus: admin changes request status.
 * - confirmAppointment: admin creates Calendar event and confirms request.
 * - upsertCustomer: admin creates/updates customers.
 *
 * Setup:
 * 1) Create a Google Sheet named "Romulus Detailing CRM".
 * 2) Copy the Sheet ID from the URL and paste it below.
 * 3) Apps Script > Project Settings > Script Properties:
 *    ADMIN_TOKEN = any long private password/token you choose.
 * 4) Run setupSheets() once.
 * 5) Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone with the link
 * 6) Paste the Web App URL into romulus-admin.html and romulus-detailing.html.
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

const STATUS_MESSAGES = {
  REQUESTED: 'Request received. Not confirmed yet. Romulus Detailing will review vehicle condition, price and availability.',
  REVIEWED: 'Request reviewed. Waiting for final confirmation or appointment options.',
  CONFIRMED: 'Appointment confirmed. Check the confirmed time and details.',
  RESCHEDULE_REQUESTED: 'Romulus Detailing needs to reschedule. Please wait for new appointment options.',
  CANCELLED: 'Request cancelled.',
  COMPLETED: 'Service completed. Thank you for choosing Romulus Detailing.'
};

function setupSheets() {
  const spreadsheet = ss();
  Object.keys(HEADERS).forEach(function(name) {
    let sh = spreadsheet.getSheetByName(name);
    if (!sh) sh = spreadsheet.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS[name]);
    } else {
      const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      if (String(existing[0] || '') !== String(HEADERS[name][0])) {
        sh.insertRowBefore(1);
        sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      }
    }
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, HEADERS[name].length);
  });
}

function resetSheetsDANGER() {
  const spreadsheet = ss();
  Object.keys(HEADERS).forEach(function(name) {
    let sh = spreadsheet.getSheetByName(name);
    if (!sh) sh = spreadsheet.insertSheet(name);
    sh.clear();
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, HEADERS[name].length);
  });
}

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    const body = parseBody(e);
    const params = Object.assign({}, e && e.parameter ? e.parameter : {}, body);
    const action = String(params.action || 'list');

    let result;
    if (action === 'createRequest') {
      result = { ok: true, requestId: createRequest(params.payload || params), status: 'REQUESTED' };
    } else if (action === 'getStatus') {
      result = { ok: true, data: getStatus(params) };
    } else if (action === 'list') {
      requireAdmin(String(params.token || ''));
      result = { ok: true, data: listAll() };
    } else if (action === 'updateStatus') {
      requireAdmin(String(params.token || ''));
      result = { ok: true, result: updateStatus(params.payload || params) };
    } else if (action === 'confirmAppointment') {
      requireAdmin(String(params.token || ''));
      result = { ok: true, result: confirmAppointment(params.payload || params) };
    } else if (action === 'upsertCustomer') {
      requireAdmin(String(params.token || ''));
      result = { ok: true, result: upsertCustomer(params.payload || params) };
    } else {
      result = { ok: false, error: 'Unknown action: ' + action };
    }

    return output(result, params.callback);
  } catch (err) {
    const params = e && e.parameter ? e.parameter : {};
    return output({ ok: false, error: String(err && err.message ? err.message : err) }, params.callback);
  }
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function output(obj, callback) {
  const text = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(String(callback).replace(/[^a-zA-Z0-9_$\.]/g, '') + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function requireAdmin(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || 'CHANGE_ME';
  if (!token || token !== expected) throw new Error('Unauthorized admin token.');
}

function ss() {
  if (!SHEET_ID || SHEET_ID === 'PASTE_GOOGLE_SHEET_ID_HERE') {
    throw new Error('SHEET_ID is not configured. Paste your Google Sheet ID in the script.');
  }
  return SpreadsheetApp.openById(SHEET_ID);
}

function sheet(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name + '. Run setupSheets().');
  return sh;
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
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
  const requestId = p.requestId || newId('REQ');
  const createdAt = nowIso();
  const phone = normalizePhone(p.phone || p.customerPhone || '');
  if (!p.customerName && !p.name) throw new Error('Customer name is required.');
  if (!phone) throw new Error('Phone is required.');

  sheet(SHEETS.REQUESTS).appendRow([
    requestId,
    createdAt,
    'REQUESTED',
    p.customerName || p.name || '',
    phone,
    p.email || '',
    p.vehicle || '',
    p.service || '',
    p.vehicleType || p.size || '',
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
    name: p.customerName || p.name || '',
    phone: phone,
    email: p.email || '',
    address: p.address || '',
    vehicle: p.vehicle || '',
    notes: 'Created from request ' + requestId
  });

  return requestId;
}

function getStatus(p) {
  const requestId = String(p.requestId || '').trim();
  const phone = normalizePhone(p.phone || '');
  if (!requestId) throw new Error('Request ID is required.');
  if (!phone) throw new Error('Phone is required.');

  const row = findRowById(SHEETS.REQUESTS, 'Request ID', requestId);
  const obj = objectFromRow(row);
  const storedPhone = normalizePhone(obj.Phone || '');
  if (!storedPhone || storedPhone.slice(-7) !== phone.slice(-7)) {
    throw new Error('Request ID and phone do not match.');
  }

  const status = String(obj.Status || 'REQUESTED');
  const appointment = findAppointmentByRequestId(requestId);
  return {
    requestId: requestId,
    status: status,
    message: STATUS_MESSAGES[status] || 'Status updated.',
    customerName: obj['Customer Name'] || '',
    vehicle: obj.Vehicle || '',
    service: obj.Service || '',
    estimatedTotal: obj['Estimated Total'] || '',
    preferredDate: obj['Preferred Date'] || '',
    preferredTime: obj['Preferred Time'] || '',
    confirmedStartTime: appointment ? appointment['Start Time'] : '',
    confirmedEndTime: appointment ? appointment['End Time'] : '',
    confirmedPrice: appointment ? appointment['Price Confirmed'] : '',
    adminNotes: status === 'CONFIRMED' ? (obj['Admin Notes'] || '') : ''
  };
}

function findAppointmentByRequestId(requestId) {
  const rows = rowsAsObjects(SHEETS.APPOINTMENTS);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]['Request ID']) === String(requestId)) return rows[i];
  }
  return null;
}

function objectFromRow(rowInfo) {
  const obj = {};
  rowInfo.headers.forEach(function(h, i) { obj[h] = rowInfo.values[i]; });
  return obj;
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
  const obj = objectFromRow(row);
  const start = new Date(p.startTime);
  const end = new Date(p.endTime);
  const title = 'Romulus Detailing - ' + (obj['Customer Name'] || 'Customer') + ' - ' + (obj.Vehicle || 'Vehicle');
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
    newId('APT'),
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
  const phone = normalizePhone(p.phone || '');
  const email = String(p.email || '').trim();
  const name = String(p.name || '').trim();
  if (!phone && !email && !name) return { skipped: true };

  const sh = sheet(SHEETS.CUSTOMERS);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const phoneIdx = headers.indexOf('Phone');
  const emailIdx = headers.indexOf('Email');

  for (let r = 1; r < values.length; r++) {
    const samePhone = phone && normalizePhone(values[r][phoneIdx]) === phone;
    const sameEmail = email && String(values[r][emailIdx]).trim().toLowerCase() === email.toLowerCase();
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
    newId('CUS'),
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
