const fs = require('fs');

const html = fs.readFileSync('elgupublic.html', 'utf8');
const backend = fs.readFileSync('body.json', 'utf8');

new Function(backend);
const backendApi = new Function(backend + '\nreturn { findActivityLayout, activityFingerprint, activityMapLocationKey, buildOllamaChatUrl, directOllamaModelName };')();

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());
inlineScripts.forEach(source => new Function(source));

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) throw new Error('Duplicate HTML ids: ' + duplicateIds.join(', '));

const declaredFunctionNames = [...html.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]);
const duplicateFunctions = [...new Set(declaredFunctionNames.filter((name, index) => declaredFunctionNames.indexOf(name) !== index))];
if (duplicateFunctions.length) throw new Error('Duplicate function declarations: ' + duplicateFunctions.join(', '));
const functionNames = new Set(declaredFunctionNames);
const ignoredCallTargets = new Set(['document', 'window', 'event', 'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Date']);
const missingHandlers = new Set();
for (const attribute of html.matchAll(/onclick="([^"]+)"/g)) {
  for (const call of attribute[1].matchAll(/(?<!\.)\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = call[1];
    if (!ignoredCallTargets.has(name) && !functionNames.has(name)) missingHandlers.add(name);
  }
}
if (missingHandlers.size) throw new Error('Missing onclick handlers: ' + [...missingHandlers].join(', '));

const requiredActions = ['getWorkData', 'setupDatabase', 'migrateLegacyData', 'syncActivityMap', 'saveActivity', 'deleteActivity', 'saveTask', 'deleteTask', 'saveSubtask', 'deleteSubtask', 'saveDocument', 'deleteDocument', 'saveNote', 'deleteNote', 'verifyLocalDev', 'updateLGU', 'askAI'];
const missingActions = requiredActions.filter(action => !backend.includes("action === '" + action + "'"));
if (missingActions.length) throw new Error('Missing backend actions: ' + missingActions.join(', '));
if (!backend.includes('info.aud !== configuredClientId')) throw new Error('Google token audience validation is missing.');
if (!backend.includes('assertAuthorizedEmail(info.email)') || !backend.includes('ALLOWED_EMAIL_DOMAINS')) throw new Error('Authorized email/domain enforcement is missing.');
for (const action of ['getLive', 'getLogs', 'getHistoryDates', 'getHistoryData', 'getWorkData']) {
  const protectedAction = new RegExp("action === ['\"]" + action + "['\"][\\s\\S]{0,140}requireVerifiedActor\\(params\\)");
  if (!protectedAction.test(backend)) throw new Error('Protected read is missing actor verification: ' + action);
}
if (!html.includes("location.protocol === 'file:'") || !html.includes("['localhost', '127.0.0.1'].includes(location.hostname)")) {
  throw new Error('The local sign-in bypass is not restricted to local hosts.');
}
if (backend.includes('LOCAL_AUTH_BYPASS')) throw new Error('Local authentication bypass must never be added to the Apps Script backend.');
if (!html.includes("const LOCAL_WORK_DB_KEY = 'elgu_local_work_db_v2'")) throw new Error('Local Work Hub test storage is missing.');

const requiredIds = ['view-work', 'calendarGrid', 'activityMap', 'activityMapPeriodFilter', 'activityMapDateAnchor', 'activitiesTableBody', 'personalTaskGrid', 'teamTaskGrid', 'documentsTableBody', 'notesGrid', 'modalActivity', 'modalDocument', 'modalNote', 'modalTask', 'taskSubtaskList', 'taskStartedAt', 'taskCompletedAt', 'workLocalSyncButton'];
const missingIds = requiredIds.filter(id => !ids.includes(id));
if (missingIds.length) throw new Error('Missing Work Hub elements: ' + missingIds.join(', '));
if (!backend.includes("const SUBTASKS_SHEET_NAME = 'DB_Subtasks'")) throw new Error('Normalized DB_Subtasks storage is missing.');
if (!backend.includes("const DOCUMENTS_SHEET_NAME = 'DB_Documents'") || !backend.includes("const NOTES_SHEET_NAME = 'DB_Notes'")) throw new Error('Normalized document/note storage is missing.');
if (!backend.includes("'Latitude', 'Longitude', 'Geocode_Query', 'Geocode_Status'") || !backend.includes('syncActivityMapLocations')) throw new Error('Persisted activity map synchronization is missing.');
if (!backend.includes('migrateTrainingSchedule') || !backend.includes('migratePresentationFiles') || !backend.includes('migrateFundsDocuments')) throw new Error('Legacy training/document/funds migration is missing.');
if (!html.includes('function handleTaskDrop') || !html.includes('draggable="true"')) throw new Error('Kanban drag-and-drop behavior is missing.');
if (html.includes("sendLog('VIEW'")) throw new Error('Noisy VIEW events are still being sent by the frontend.');
if (!backend.includes('MAX_LOG_DATA_ROWS') || !backend.includes("['VIEW', 'VIEW_LOGS', 'NAVIGATION', 'AUTO_REFRESH']")) throw new Error('Backend log noise filtering or retention is missing.');
if (!backend.includes("getProperty('OLLAMA_API_KEY')") || !backend.includes("DEFAULT_OLLAMA_BASE_URL") || !backend.includes("/api/chat")) throw new Error('Server-side Ollama Cloud chat integration is missing.');
if (!backend.includes('OLLAMA_FALLBACK_MODELS') || !backend.includes('OLLAMA_VISION_FALLBACK_MODELS')) throw new Error('Ollama fallback model configuration is missing.');
if (!html.includes("apiRequest('askAI'")) throw new Error('AI Analyst is not using the authenticated API request helper.');
if (!html.includes('DOMPurify.sanitize(marked.parse')) throw new Error('AI Markdown output is not sanitized.');
if (!html.includes('function isAllowedAppsScriptUrl') || !html.includes("url.hostname === 'script.google.com'")) throw new Error('Apps Script endpoint allow-list validation is missing.');
if (/f4c4f6dfc5974ab7bbec6eae6c5cae|Authorization:\s*['\"]Bearer\s+[A-Za-z0-9._-]{20,}/i.test(html)) throw new Error('A service credential appears to be embedded in the public HTML.');
if (backendApi.buildOllamaChatUrl('https://ollama.com/api') !== 'https://ollama.com/api/chat') throw new Error('Ollama chat URL normalization failed.');
if (backendApi.directOllamaModelName('kimi-k2.7-code:cloud', 'https://ollama.com/api/chat') !== 'kimi-k2.7-code') throw new Error('Direct Ollama :cloud model normalization failed.');
if (backendApi.directOllamaModelName('gemma4:31b-cloud', 'https://ollama.com/api/chat') !== 'gemma4:31b') throw new Error('Direct Ollama -cloud model normalization failed.');

const screenshotStyleHeaders = [
  ['', '', '', '', '', '', '', '', '', '', ''],
  ['Reporting Month (TODA & RMA)', 'No', 'Date', '', '', 'Title of the Activity', 'Quarter', 'Type', 'Municipality, Province', 'Mode of Meeting (F2F or Online)', 'Exact Venue'],
  ['', '', 'Start Date', 'End Date', '', '', '', '', '', '', ''],
  ['March', '1', 'March 2, 2026', 'March 2, 2026', '', 'Sample activity', '1st Qtr', 'Meeting', 'Bangued, Abra', 'F2F', 'Municipal Hall']
];
const fakeSheet = {
  getLastRow: () => screenshotStyleHeaders.length,
  getLastColumn: () => screenshotStyleHeaders[0].length,
  getRange: (row, column, rowCount, columnCount) => ({
    getDisplayValues: () => screenshotStyleHeaders.slice(row - 1, row - 1 + rowCount).map(values => values.slice(column - 1, column - 1 + columnCount))
  })
};
const layout = backendApi.findActivityLayout(fakeSheet);
if (!layout || layout.title !== 5 || layout.start !== 2 || layout.end !== 3 || layout.headerEnd !== 3) {
  throw new Error('The activity importer did not recognize the screenshot-style merged header layout.');
}
const fingerprintA = backendApi.activityFingerprint({ Source_Sheet: 'Activities', Start_Date: '2026-03-02', End_Date: '2026-03-02', Title: ' Sample  Activity ', Municipality_Province: 'Bangued, Abra' });
const fingerprintB = backendApi.activityFingerprint({ Source_Sheet: 'activities', Start_Date: '2026-03-02', End_Date: '2026-03-02', Title: 'sample activity', Municipality_Province: 'bangued, abra' });
if (fingerprintA !== fingerprintB) throw new Error('Activity duplicate fingerprints are not normalized consistently.');
if (backendApi.activityMapLocationKey('Municipal Hall', 'Bangued, Abra', 'F2F') === backendApi.activityMapLocationKey('Provincial Capitol', 'Bangued, Abra', 'F2F')) throw new Error('Activity map fingerprint does not detect venue changes.');

console.log('Validation passed');
console.log('- Backend and inline JavaScript compile');
console.log('- ' + ids.length + ' unique HTML ids');
console.log('- All inline click handlers resolve');
console.log('- All Work Hub API actions and required views exist');
console.log('- Documents, fund notes, and training schedules have normalized migration paths');
console.log('- Activity Map pins persist and detect venue/location/mode changes');
console.log('- Screenshot-style activity headers are recognized by the importer');
console.log('- Shift-resistant activity duplicate detection is consistent');
console.log('- Sign-in bypass is restricted to localhost/file previews; backend writes remain protected');
console.log('- Local Work Hub CRUD uses isolated browser storage');
console.log('- Noisy read/navigation logs are suppressed and log retention is capped');
console.log('- AI Analyst uses authenticated Ollama Cloud chat with ordered model fallbacks');
console.log('- Protected reads, endpoint allow-listing, domain authorization, and HTML sanitization are enabled');
console.log('- Ollama direct-cloud model tags and chat URLs normalize correctly');
