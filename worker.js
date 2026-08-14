// Worker: serve o app (assets) + API de sincronização da lista.
// A lista fica guardada no KV, identificada por um "código da lista".

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS)
  });
}

// junta dois documentos: para cada chave, vence quem tem o carimbo (ts) mais novo
function mesclar(a, b) {
  a = a || { d: {}, ts: {} };
  b = b || { d: {}, ts: {} };
  const out = { d: {}, ts: {} };
  const chaves = new Set(Object.keys(a.ts || {}).concat(Object.keys(b.ts || {})));
  chaves.forEach(function (k) {
    const ta = (a.ts && a.ts[k]) || 0;
    const tb = (b.ts && b.ts[k]) || 0;
    const vencedor = tb > ta ? b : a;
    out.ts[k] = Math.max(ta, tb);
    if (vencedor.d && Object.prototype.hasOwnProperty.call(vencedor.d, k)) {
      out.d[k] = vencedor.d[k];
    }
  });
  return out;
}

function limparCodigo(c) {
  return (c || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);       // serve o app
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const m = url.pathname.match(/^\/api\/lista\/(.+)$/);
    if (!m) return json({ erro: 'rota desconhecida' }, 404);

    const codigo = limparCodigo(m[1]);
    if (codigo.length < 3) return json({ erro: 'código inválido' }, 400);

    const kvKey = 'lista:' + codigo;

    if (request.method === 'GET') {
      const guardado = await env.LISTA.get(kvKey, 'json');
      return json(guardado || { d: {}, ts: {} });
    }

    if (request.method === 'POST') {
      let recebido;
      try { recebido = await request.json(); }
      catch (e) { return json({ erro: 'json inválido' }, 400); }

      const guardado = await env.LISTA.get(kvKey, 'json');
      const juntado = mesclar(guardado, recebido);
      await env.LISTA.put(kvKey, JSON.stringify(juntado));
      return json(juntado);
    }

    return json({ erro: 'método não suportado' }, 405);
  }
};
