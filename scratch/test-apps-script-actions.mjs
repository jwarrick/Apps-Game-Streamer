const url = 'https://script.google.com/macros/s/AKfycbyeSCjUUHEreKsb8t1Z3YvPyaazk_7VzgBYC8ZTCaoKE1O6seJQuEXjoIifQEa2dFqJuw/exec';

async function test() {
  const actions = ['download', 'get', 'getFile', 'read'];
  for (const a of actions) {
    try {
      const res = await fetch(`${url}?action=${a}&fileId=13y0rIml66eztBQNOMiJFnbuOr4cSuU8u`, { redirect: 'follow' });
      const text = await res.text();
      console.log(`GET action=${a}: status=${res.status}, len=${text.length}, preview=${text.slice(0, 100)}`);
    } catch (e) {
      console.log(`GET action=${a} error:`, e.message);
    }
  }

  // Also test POST with action
  for (const a of actions) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: a, fileId: '13y0rIml66eztBQNOMiJFnbuOr4cSuU8u' }),
        redirect: 'follow'
      });
      const text = await res.text();
      console.log(`POST action=${a}: status=${res.status}, len=${text.length}, preview=${text.slice(0, 100)}`);
    } catch (e) {
      console.log(`POST action=${a} error:`, e.message);
    }
  }
}

test();
