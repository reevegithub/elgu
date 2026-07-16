const fs = require('fs');

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

async function main() {
  const html = fs.readFileSync('elgupublic.html', 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(source => source.trim());
  const mainScript = scripts[scripts.length - 1];
  const documentMock = { addEventListener() {} };
  const windowMock = {};
  const locationMock = { protocol: 'file:', hostname: '' };
  const localStorageMock = createStorage();
  const sessionStorageMock = createStorage();
  const api = new Function('document', 'window', 'location', 'localStorage', 'sessionStorage', mainScript + '\nreturn { localWorkApiRequest, readLocalWorkDatabase };')(
    documentMock, windowMock, locationMock, localStorageMock, sessionStorageMock
  );

  let data = await api.localWorkApiRequest('getWorkData', {});
  if (!data.needsSetup) throw new Error('Fresh local database should require setup.');
  await api.localWorkApiRequest('setupDatabase', {});
  const task = (await api.localWorkApiRequest('saveTask', { record: { Title: 'Test task', Task_Type: 'Team', Status: 'To Do', Start_Date: '2026-07-16', Due_Date: '2026-07-20' } })).record;
  const subtask = (await api.localWorkApiRequest('saveSubtask', { record: { Task_ID: task.ID, Title: 'Test subtask', Status: 'In Progress', Due_Date: '2026-07-18' } })).record;
  data = await api.localWorkApiRequest('getWorkData', {});
  if (data.tasks.length !== 1 || data.subtasks.length !== 1 || data.subtasks[0].Task_ID !== task.ID) throw new Error('Local task/subtask persistence failed.');
  await api.localWorkApiRequest('deleteTask', { id: task.ID });
  data = await api.localWorkApiRequest('getWorkData', {});
  if (data.tasks.length || data.subtasks.length) throw new Error('Deleting a local task did not soft-delete its subtasks.');
  if (!subtask.ID.startsWith('SUB-')) throw new Error('Local subtask ID format is invalid.');
  console.log('Local Work Hub behavior passed: setup, task CRUD, normalized subtask CRUD, cascade soft delete');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
