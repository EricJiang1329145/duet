import {
  ACTION,
  CROPS,
  CROP_IDS,
  GREENHOUSE_COST
} from "../config.js";
import { canClaimGift, getCoins } from "../game/farmRules.js";
import { clockNow } from "../runtime/clock.js";
import { getSeason } from "../game/season.js";

function cropCard(crop) {
  const article = document.createElement("article");
  article.className = "shop-seed";
  article.dataset.crop = crop.id;

  const head = document.createElement("div");
  head.className = "shop-seed__head";
  const name = document.createElement("b");
  name.textContent = crop.label;
  const price = document.createElement("span");
  price.textContent = `${crop.seedCost} 金币 / 颗`;
  head.append(name, price);

  const copy = document.createElement("p");
  copy.className = "shop-seed__copy";
  const currentSeason = getSeason(clockNow()).id;
  copy.textContent = `${crop.description} ${
    crop.season === currentSeason ? "· 当季生长更快" : "· 反季生长较慢"
  }`;

  const foot = document.createElement("div");
  foot.className = "shop-seed__foot";
  const count = document.createElement("span");
  count.className = "shop-seed__count";
  const countValue = document.createElement("b");
  countValue.dataset.count = crop.id;
  count.append("已有 ", countValue);
  const buy = document.createElement("button");
  buy.className = "shop-buy";
  buy.type = "button";
  buy.dataset.buy = crop.id;
  buy.textContent = "买 1 颗";
  foot.append(count, buy);

  article.append(head, copy, foot);
  return article;
}

/**
 * Seed shop and upgrade card. It only renders state and dispatches intents;
 * the room authority applies them and sends the resulting state back.
 */
export function createShopPanel({ dispatch, getState, onClose = null }) {
  const panelEl = document.getElementById("shop-panel");
  const backdropEl = document.getElementById("shop-backdrop");
  const closeEl = document.getElementById("shop-close");
  const seedsEl = document.getElementById("shop-seeds");
  const coinsEl = document.getElementById("shop-coins");
  const greenhouseBtn = document.getElementById("shop-greenhouse");
  const greenhousePrice = document.getElementById("shop-greenhouse-price");
  const greenhouseCopy = document.getElementById("shop-greenhouse-copy");
  const giftBtn = document.getElementById("shop-gift");
  const giftCopy = document.getElementById("shop-gift-copy");
  const giftPrice = document.getElementById("shop-gift-price");

  for (const cropId of CROP_IDS) {
    seedsEl.append(cropCard(CROPS[cropId]));
  }

  let isOpen = false;

  function setOpen(open) {
    if (isOpen === open) return;
    isOpen = open;
    panelEl.hidden = !open;
    document.documentElement.classList.toggle("shop-open", open);
    if (open) sync(getState());
  }

  function buySeed(cropId) {
    dispatch(ACTION.BUY_SEED, null, { cropType: cropId, count: 1 });
  }

  let lastSignature = "";

  function sync(state = getState()) {
    if (!state) return;
    const coins = getCoins(state);
    const giftReady = canClaimGift(state, clockNow());
    const signature = JSON.stringify([
      coins,
      state.inventory?.seeds,
      Boolean(state.world?.greenhouse),
      giftReady
    ]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    if (coinsEl) coinsEl.textContent = String(coins);

    for (const cropId of CROP_IDS) {
      const crop = CROPS[cropId];
      const card = seedsEl.querySelector(`[data-crop="${cropId}"]`);
      if (!card) continue;
      const count = state.inventory?.seeds?.[cropId] ?? 0;
      const countEl = card.querySelector(`[data-count="${cropId}"]`);
      if (countEl) countEl.textContent = String(count);
      const buy = card.querySelector(`[data-buy="${cropId}"]`);
      if (buy) {
        buy.disabled = coins < crop.seedCost;
        buy.textContent = coins < crop.seedCost ? "金币不够" : "买 1 颗";
      }
    }

    const built = Boolean(state.world?.greenhouse);
    if (greenhouseBtn) {
      greenhouseBtn.disabled = built || coins < GREENHOUSE_COST;
      greenhouseBtn.textContent = built
        ? "已搭好"
        : coins < GREENHOUSE_COST
          ? "金币不够"
          : "搭温室";
    }
    if (greenhousePrice) {
      greenhousePrice.textContent = built ? "已完成" : `${GREENHOUSE_COST} 金币`;
    }
    if (greenhouseCopy) {
      greenhouseCopy.textContent = built
        ? "温室已经建好：从院子下方的温室门进入，11/12 号田在室内。"
        : "建在院子下方的 11/12 号田上（池塘左侧），收成多卖 25%，且必定回收一颗种子。";
    }

    if (giftBtn) {
      giftBtn.disabled = !giftReady;
      giftBtn.textContent = giftReady ? "领取" : "今天已领";
    }
    if (giftPrice) giftPrice.textContent = giftReady ? "免费" : "明天再来";
    if (giftCopy) {
      giftCopy.textContent = giftReady
        ? "每天可以领一次：6 金币 + 2 颗小萝卜种子。"
        : "今天的补给已经领过了，明天再来。";
    }
  }

  function onSeedsPointerDown(event) {
    const button = event.target.closest?.("[data-buy]");
    if (!button) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    buySeed(button.dataset.buy);
  }

  function onGreenhousePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (greenhouseBtn.disabled) return;
    dispatch(ACTION.BUY_GREENHOUSE, null, null);
  }

  function onGiftPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (giftBtn.disabled) return;
    dispatch(ACTION.CLAIM_GIFT, null, null);
  }

  function onClosePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    onClose?.();
  }

  seedsEl.addEventListener("pointerdown", onSeedsPointerDown, { passive: false });
  greenhouseBtn.addEventListener("pointerdown", onGreenhousePointerDown, {
    passive: false
  });
  giftBtn.addEventListener("pointerdown", onGiftPointerDown, { passive: false });
  closeEl.addEventListener("pointerdown", onClosePointerDown, { passive: false });
  backdropEl.addEventListener("pointerdown", onClosePointerDown, {
    passive: false
  });

  window.addEventListener("keydown", (event) => {
    if (!isOpen || event.key !== "Escape") return;
    setOpen(false);
    onClose?.();
  });

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    sync,
    isOpen: () => isOpen
  };
}
