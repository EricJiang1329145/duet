import { ACTION, DECOR, DECOR_IDS, SCENE } from "../config.js";
import { getCoins } from "../game/farmRules.js";
import { getActivePlayer } from "../game/player.js";
import { countDecor } from "../game/world.js";

function decorCard(item) {
  const article = document.createElement("article");
  article.className = "decor-item";
  article.dataset.item = item.id;

  const head = document.createElement("div");
  head.className = "decor-item__head";
  const name = document.createElement("b");
  name.textContent = item.label;
  const price = document.createElement("span");
  price.className = "decor-item__price";
  price.textContent = `${item.cost} 金币`;
  head.append(name, price);

  const copy = document.createElement("p");
  copy.className = "decor-item__copy";
  copy.textContent = item.description;

  const foot = document.createElement("div");
  foot.className = "decor-item__foot";
  const state = document.createElement("span");
  state.className = "decor-item__state";
  state.dataset.state = item.id;
  state.textContent = "未添置";
  const buy = document.createElement("button");
  buy.className = "shop-buy";
  buy.type = "button";
  buy.dataset.buy = item.id;
  buy.textContent = "添置";
  foot.append(state, buy);

  article.append(head, copy, foot);
  return article;
}

/**
 * Second-floor decoration catalogue. Buying is server-authoritative in room
 * mode; this module only renders the catalogue and dispatches intents.
 */
export function createDecorPanel({ dispatch, getState }) {
  const panelEl = document.getElementById("decor-panel");
  const backdropEl = document.getElementById("decor-backdrop");
  const closeEl = document.getElementById("decor-close");
  const listEl = document.getElementById("decor-list");
  const coinsEl = document.getElementById("decor-coins");
  const noteEl = document.getElementById("decor-note");

  for (const itemId of DECOR_IDS) {
    listEl.append(decorCard(DECOR[itemId]));
  }

  let isOpen = false;

  function setOpen(next) {
    if (isOpen === next) return;
    isOpen = next;
    panelEl.hidden = !next;
    document.documentElement.classList.toggle("decor-open", next);
    if (next) sync(getState());
  }

  let lastSignature = "";

  function sync(state = getState()) {
    if (!state) return;
    const player = getActivePlayer(state);
    const shouldOpen = Boolean(
      state.ui.decorOpen && player?.currentScene === SCENE.INDOOR_2
    );
    setOpen(shouldOpen);
    if (!shouldOpen) {
      lastSignature = "";
      return;
    }

    const coins = getCoins(state);
    const signature = JSON.stringify([
      coins,
      player.currentScene,
      state.world?.decor
    ]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    if (coinsEl) coinsEl.textContent = String(coins);
    if (noteEl) {
      noteEl.textContent = `已添置 ${countDecor(state.world)} / ${DECOR_IDS.length} 件 · 两端共享`;
    }

    for (const itemId of DECOR_IDS) {
      const item = DECOR[itemId];
      const card = listEl.querySelector(`[data-item="${itemId}"]`);
      if (!card) continue;
      const owned = Boolean(state.world?.decor?.[itemId]);
      const stateEl = card.querySelector(`[data-state="${itemId}"]`);
      const buy = card.querySelector(`[data-buy="${itemId}"]`);
      if (stateEl) {
        stateEl.textContent = owned ? "已添置" : "未添置";
        stateEl.classList.toggle("is-owned", owned);
      }
      if (buy) {
        buy.dataset.mode = owned ? "remove" : "buy";
        buy.disabled = !owned && coins < item.cost;
        buy.textContent = owned
          ? `退还 ${item.cost}`
          : coins < item.cost
            ? "金币不够"
            : "添置";
      }
    }
  }

  function act(itemId, mode) {
    dispatch(
      mode === "remove" ? ACTION.REMOVE_DECOR : ACTION.BUY_DECOR,
      itemId,
      { itemId }
    );
  }

  function onListPointerDown(event) {
    const button = event.target.closest?.("[data-buy]");
    if (!button) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    act(button.dataset.buy, button.dataset.mode);
  }

  function onClosePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch(ACTION.CLOSE_DECOR, null, null);
  }

  listEl.addEventListener("pointerdown", onListPointerDown, { passive: false });
  closeEl.addEventListener("pointerdown", onClosePointerDown, { passive: false });
  backdropEl.addEventListener("pointerdown", onClosePointerDown, {
    passive: false
  });

  window.addEventListener("keydown", (event) => {
    if (!isOpen || event.key !== "Escape") return;
    dispatch(ACTION.CLOSE_DECOR, null, null);
  });

  return {
    sync,
    open: () => setOpen(true),
    close: () => dispatch(ACTION.CLOSE_DECOR, null, null),
    isOpen: () => isOpen
  };
}
