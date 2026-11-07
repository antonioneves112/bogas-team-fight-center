// Simulador do Supabase (REST + RPC + Auth + Functions) em memória.
// Interceta os pedidos do browser para *.supabase.co, para os testes nunca tocarem na base de dados real.

export const PROJETO_REF = "lvtodcvtsetapgimkmtl";

function clonar(v) {
  return JSON.parse(JSON.stringify(v));
}

function comparar(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== null && b !== null && a !== "" && b !== "" && !isNaN(na) && !isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

function aplicarFiltro(linhas, coluna, expressao) {
  const ponto = expressao.indexOf(".");
  const op = expressao.slice(0, ponto);
  const valor = expressao.slice(ponto + 1);
  return linhas.filter((l) => {
    const v = l[coluna];
    switch (op) {
      case "eq":
        return String(v) === valor;
      case "neq":
        return String(v) !== valor;
      case "gt":
        return comparar(v, valor) > 0;
      case "gte":
        return comparar(v, valor) >= 0;
      case "lt":
        return comparar(v, valor) < 0;
      case "lte":
        return comparar(v, valor) <= 0;
      case "ilike": {
        const re = new RegExp(
          "^" + valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$",
          "i",
        );
        return re.test(String(v ?? ""));
      }
      case "in": {
        const lista = valor.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
        return lista.includes(String(v));
      }
      case "is":
        return valor === "null" ? v === null || v === undefined : String(v) === valor;
      default:
        return true;
    }
  });
}

const PARAMS_RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

export class MockSupabase {
  constructor({ tabelas = {}, rpc = {}, utilizadorAuth = null } = {}) {
    this.tabelas = clonar(tabelas);
    this.rpc = rpc;
    this.utilizadorAuth = utilizadorAuth;
    this.pedidos = [];
    this.webhooks = [];
    this.proximoId = 10000;
  }

  pedidosA(tipo, nome) {
    return this.pedidos.filter((p) => p.tipo === tipo && (!nome || p.nome === nome));
  }

  async instalar(contexto) {
    await contexto.route(/https:\/\/[a-z0-9]+\.supabase\.co\/.*/, (route) => this.tratar(route));
    await contexto.route(/https:\/\/hook\.[a-z0-9]+\.make\.com\/.*/, (route) => {
      const req = route.request();
      this.webhooks.push(JSON.parse(req.postData() || "{}"));
      route.fulfill({ status: 200, body: "Accepted" });
    });
  }

  responder(route, status, corpo, cabecalhos = {}) {
    return route.fulfill({
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
        "access-control-expose-headers": "content-range",
        ...cabecalhos,
      },
      body: corpo === undefined ? "" : JSON.stringify(corpo),
    });
  }

  async tratar(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metodo = req.method();
    if (metodo === "OPTIONS") return this.responder(route, 200, undefined);

    let corpo = null;
    try {
      corpo = req.postData() ? JSON.parse(req.postData()) : null;
    } catch {
      corpo = req.postData();
    }
    const caminho = url.pathname;

    // ---------- AUTH ----------
    if (caminho.startsWith("/auth/v1/")) {
      this.pedidos.push({ tipo: "auth", nome: caminho, corpo });
      if (caminho === "/auth/v1/token") {
        if (this.utilizadorAuth && corpo?.email === this.utilizadorAuth.email && corpo?.password === this.utilizadorAuth.password) {
          return this.responder(route, 200, sessaoFalsa(this.utilizadorAuth.email));
        }
        return this.responder(route, 400, { error: "invalid_grant", error_description: "Invalid login credentials", code: "invalid_credentials" });
      }
      if (caminho === "/auth/v1/user") return this.responder(route, 200, sessaoFalsa(this.utilizadorAuth?.email || "t@t.pt").user);
      return this.responder(route, 204, undefined);
    }

    // ---------- EDGE FUNCTIONS ----------
    if (caminho.startsWith("/functions/v1/")) {
      const nome = caminho.replace("/functions/v1/", "");
      this.pedidos.push({ tipo: "function", nome, corpo });
      return this.responder(route, 200, { mensagem: "ok" });
    }

    // ---------- RPC ----------
    if (caminho.startsWith("/rest/v1/rpc/")) {
      const nome = caminho.replace("/rest/v1/rpc/", "");
      this.pedidos.push({ tipo: "rpc", nome, corpo });
      const fn = this.rpc[nome];
      if (!fn) return this.responder(route, 404, { code: "PGRST202", message: `Could not find the function public.${nome}` });
      try {
        const resultado = await fn(corpo || {}, this);
        return this.responder(route, 200, resultado === undefined ? null : resultado);
      } catch (e) {
        return this.responder(route, 400, { code: "P0001", message: e.message });
      }
    }

    // ---------- REST ----------
    if (caminho.startsWith("/rest/v1/")) {
      const tabela = caminho.replace("/rest/v1/", "");
      this.pedidos.push({ tipo: "rest", nome: tabela, metodo, query: url.search, corpo });
      // Falhas forçadas pelos testes (ex.: simular "permission denied" num insert).
      if ((this.falhas || []).some((f) => f.tabela === tabela && f.metodo === metodo)) {
        return this.responder(route, 403, { code: "42501", message: `permission denied for table ${tabela}` });
      }
      if (!(tabela in this.tabelas)) {
        return this.responder(route, 404, { code: "42P01", message: `relation "public.${tabela}" does not exist` });
      }
      let linhas = this.tabelas[tabela];
      let filtradas = linhas;
      for (const [k, v] of url.searchParams) {
        if (!PARAMS_RESERVADOS.has(k)) filtradas = aplicarFiltro(filtradas, k, v);
      }
      const cab = req.headers();
      const prefer = cab["prefer"] || "";
      const objeto = (cab["accept"] || "").includes("vnd.pgrst.object");

      if (metodo === "GET" || metodo === "HEAD") {
        const select = url.searchParams.get("select") || "*";
        const colunasPedidas = select
          .replace(/\s+/g, "")
          .replace(/\w+\([^)]*\)/g, "")
          .split(",")
          .filter((c) => c && c !== "*");
        for (const c of colunasPedidas) {
          if (filtradas.length && !(c in (linhas[0] || {}))) {
            return this.responder(route, 400, { code: "42703", message: `column ${tabela}.${c} does not exist` });
          }
        }
        let resultado = clonar(filtradas);
        const ordem = url.searchParams.get("order");
        if (ordem) {
          const [col, dir] = ordem.split(",")[0].split(".");
          resultado.sort((a, b) => comparar(a[col], b[col]) * (dir === "desc" ? -1 : 1));
        }
        const limite = url.searchParams.get("limit");
        if (limite) resultado = resultado.slice(0, Number(limite));
        const embebida = select.match(/(\w+)\(([^)]*)\)/);
        if (embebida) {
          const [, rel] = embebida;
          const singular = (n) => n.replace(/s$/, "");
          resultado = resultado.map((r) => {
            const chaveMuitosParaUm = `${singular(rel)}_id`;
            // muitos-para-um (mensalidades -> socios) devolve objeto;
            // um-para-muitos (produtos -> produto_variantes) devolve lista.
            const valor =
              chaveMuitosParaUm in r
                ? (this.tabelas[rel] || []).find((x) => x.id === r[chaveMuitosParaUm]) || null
                : (this.tabelas[rel] || []).filter((x) => x[`${singular(tabela)}_id`] === r.id);
            return { ...r, [rel]: clonar(valor) };
          });
        }
        if (colunasPedidas.length && !embebida) {
          resultado = resultado.map((r) => Object.fromEntries(colunasPedidas.map((c) => [c, r[c]])));
        }
        const cabCount = prefer.includes("count=") ? { "content-range": `0-${Math.max(resultado.length - 1, 0)}/${filtradas.length}` } : {};
        if (metodo === "HEAD") return this.responder(route, 200, undefined, cabCount);
        if (objeto) {
          if (resultado.length !== 1) return this.responder(route, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${resultado.length} rows` });
          return this.responder(route, 200, resultado[0], cabCount);
        }
        return this.responder(route, 200, resultado, cabCount);
      }

      if (metodo === "POST") {
        const novas = (Array.isArray(corpo) ? corpo : [corpo]).map((r) => ({ id: this.proximoId++, ...r }));
        const conflito = url.searchParams.get("on_conflict");
        for (const n of novas) {
          const existente = conflito ? linhas.find((l) => String(l[conflito]) === String(n[conflito])) : null;
          if (existente) Object.assign(existente, n, { id: existente.id });
          else linhas.push(n);
        }
        if (prefer.includes("return=representation")) {
          return this.responder(route, 201, objeto ? novas[0] : novas);
        }
        return this.responder(route, 201, undefined);
      }

      if (metodo === "PATCH") {
        filtradas.forEach((l) => Object.assign(l, corpo));
        return this.responder(route, prefer.includes("return=representation") ? 200 : 204, prefer.includes("return=representation") ? filtradas : undefined);
      }

      if (metodo === "DELETE") {
        this.tabelas[tabela] = linhas.filter((l) => !filtradas.includes(l));
        return this.responder(route, 204, undefined);
      }
    }

    return this.responder(route, 404, { message: "rota não simulada" });
  }
}

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export function sessaoFalsa(email) {
  const agora = Math.floor(Date.now() / 1000);
  const exp = agora + 3600 * 24;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ sub: user.id, email, role: "authenticated", aud: "authenticated", exp, iat: agora })}.assinatura`;
  return {
    access_token: jwt,
    token_type: "bearer",
    expires_in: 3600 * 24,
    expires_at: exp,
    refresh_token: "refresh-falso",
    user,
  };
}

// Script a injetar ANTES de a página carregar para simular um treinador com sessão iniciada.
export function scriptSessaoTreinador(email) {
  const chave = `sb-${PROJETO_REF}-auth-token`;
  return `localStorage.setItem(${JSON.stringify(chave)}, ${JSON.stringify(JSON.stringify(sessaoFalsa(email)))});`;
}
