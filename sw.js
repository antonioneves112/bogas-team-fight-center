// =========================================================================
// 🥊 MOTOR DA APP (SERVICE WORKER) - BOGAS TEAM - V14
// =========================================================================
const CACHE_NAME = "bogas-team-v63";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./portal.html",
  "./CSS/theme.css",
  "./CSS/home.css",
  "./CSS/portal.css",
  "./CSS/dashboard.css",
  "./JS/main.js",
  "./JS/portal.js",
  "./faviicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("supabase.co") ||
    event.request.url.match(/\.(mp4|webm|ogg)$/i)
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (!res || res.status !== 200 || res.type !== "basic") return res;
        const clone = res.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});

// 🥊 RECEÇÃO DE NOTIFICAÇÕES (BLINDADO E AGRESSIVO)
self.addEventListener("push", (event) => {
  let titulo = "Bogas Team";
  let mensagem = "Nova mensagem recebida!";

  if (event.data) {
    try {
      const payload = event.data.json();
      titulo = payload.titulo || payload.title || titulo;
      mensagem =
        payload.mensagem || payload.body || payload.message || mensagem;
    } catch (e) {
      mensagem = event.data.text() || mensagem;
    }
  }

  const options = {
    body: mensagem,
    icon: "./faviicon.png",
    badge: "./icone.png",
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Vibração tática de alerta
    requireInteraction: true, // 🥊 NOVO: Obriga o pop-up a ficar no ecrã até ser fechado ou clicado!
    tag: "alerta-geral", // Agrupa as mensagens para não inundar o ecrã
    data: { url: "/portal.html" },
  };

  event.waitUntil(self.registration.showNotification(titulo, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((tabs) => {
        for (let tab of tabs) {
          if (tab.url.includes("portal.html") && "focus" in tab)
            return tab.focus();
        }
        if (clients.openWindow) return clients.openWindow("/portal.html");
      }),
  );
});

// =========================================================================
// 🥊 COMUNICAÇÃO DE VERSÃO COM A APP
// =========================================================================
self.addEventListener("message", (event) => {
  if (event.data && event.data.tipo === "PEDIR_VERSAO") {
    // Responde com o nome da Cache atual (ou podes escrever a versão à mão)
    event.source.postMessage({
      tipo: "RESPOSTA_VERSAO",
      // Se a tua variável se chamar de outra forma no topo do ficheiro, muda aqui:
      versao: typeof CACHE_NAME !== "undefined" ? CACHE_NAME : "v1.0.0",
    });
  }
});
