import { Room } from "./room.js";
import { getSessionSeat } from "./auth.js";
import { handleHashPage } from "./hashPage.js";
import { handleLoginPage, handleLogout } from "./loginPage.js";

export { Room };

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login") {
      return handleLoginPage(request, env);
    }

    if (url.pathname === "/logout") {
      return handleLogout(request);
    }

    if (url.pathname === "/hash") {
      return handleHashPage(request);
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      // The browser cannot set this header; the Worker derives it from the
      // signed HttpOnly cookie before forwarding the upgrade to the DO.
      const seat = await getSessionSeat(request, env);
      if (!seat) {
        return new Response("Unauthorized", {
          status: 401,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store"
          }
        });
      }

      // One online room. Old ?room=test links are folded into MAIN; a URL
      // cannot create a second room anymore.
      const room = "MAIN";

      const authed = new Request(request, {
        headers: new Headers(request.headers)
      });
      authed.headers.set("x-duet-seat", seat);
      const stub = env.ROOM.getByName(room);
      return stub.fetch(authed);
    }

    if (url.pathname === "/ping") {
      const cf = request.cf || {};
      return new Response(
        JSON.stringify({
          ok: true,
          t: Date.now(),
          colo: cf.colo ?? null,
          country: cf.country ?? null,
          city: cf.city ?? null,
          region: cf.region ?? null,
          asn: cf.asn ?? null,
          asOrganization: cf.asOrganization ?? null,
          httpProtocol: cf.httpProtocol ?? null,
          clientTcpRtt: cf.clientTcpRtt ?? null
        }),
        { headers: JSON_HEADERS }
      );
    }

    if (url.pathname === "/health") {
      return new Response("ok", {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    // Solo mode is local-only and has no WebSocket, so it intentionally stays
    // available without a seat cookie. Every networked page requires a valid
    // session; the WebSocket endpoint above is the hard authorization gate.
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const solo =
        url.searchParams.get("solo") === "1" ||
        url.searchParams.has("preview");
      if (!solo) {
        const seat = await getSessionSeat(request, env);
        if (!seat) {
          return new Response(null, {
            status: 302,
            headers: {
              location: `/login?next=${encodeURIComponent(
                `${url.pathname}${url.search}`
              )}`,
              "cache-control": "no-store"
            }
          });
        }
      }
    }

    return env.ASSETS.fetch(request);
  }
};
