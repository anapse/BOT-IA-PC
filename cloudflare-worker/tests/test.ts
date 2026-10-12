import worker from '../src/index.ts';

async function runTests() {
  console.log('--- Running Tests ---');

  // Mock Env
  const mockEnv = {
    FIREBASE_PROJECT_ID: 'test-project',
    ADMIN_EMAILS: 'admin@example.com',
    WORKER_KV: {
      data: new Map(),
      async get(key: string) { return this.data.get(key); },
      async put(key: string, value: string) { this.data.set(key, value); }
    }
  };

  // Test 1: GET /status
  const statusRes = await worker.fetch(new Request('http://localhost/status'), mockEnv);
  console.log('Test GET /status (200):', statusRes.status === 200 ? 'PASSED' : 'FAILED');

  // Test 2: POST /sync (No Authorization header)
  const syncNoAuthRes = await worker.fetch(new Request('http://localhost/sync', { method: 'POST' }), mockEnv);
  console.log('Test POST /sync (401 - No Auth):', syncNoAuthRes.status === 401 ? 'PASSED' : 'FAILED');

  // Test 3: POST /sync (Invalid Token - Admin check fails)
  const syncInvalidTokenRes = await worker.fetch(new Request('http://localhost/sync', { 
    method: 'POST', 
    headers: { 'Authorization': 'Bearer invalid-token' } 
  }), mockEnv);
  console.log('Test POST /sync (403 - Invalid Token):', syncInvalidTokenRes.status === 403 ? 'PASSED' : 'FAILED');

  // Test 4: POST /sync (Malformed JSON)
  const syncMalformedRes = await worker.fetch(new Request('http://localhost/sync', { 
    method: 'POST', 
    headers: { 'Authorization': 'Bearer valid-test-token', 'Content-Type': 'application/json' },
    body: 'invalid json'
  }), mockEnv);
  console.log('Test POST /sync (400 - Malformed JSON):', syncMalformedRes.status === 400 ? 'PASSED' : 'FAILED');

  console.log('--- Tests Finished ---');
}

runTests().catch(console.error);
