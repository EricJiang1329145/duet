import {
  ACTION,
  CROPS,
  DISHES,
  DISH_IDS,
  GOODS,
  RECIPES,
  RECIPE_IDS,
  SCENE
} from "../config.js";
import { getActivePlayer } from "../game/player.js";
import {
  dishCount,
  mealLabel,
  recipeMissing
} from "../game/kitchen.js";

function element(tag, className = "", text = undefined) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function ingredientChips(recipe, kind, refs) {
  const wrap = element("div", "kitchen-recipe__ingredients");
  const bag = kind === "produce" ? recipe.produce : recipe.goods;
  for (const [id, need] of Object.entries(bag)) {
    const config = kind === "produce" ? CROPS[id] : GOODS[id];
    const chip = element("span", "kitchen-chip");
    const label = element(
      "span",
      "kitchen-chip__label",
      `${config?.short ?? config?.label ?? id} 0/${need}`
    );
    chip.append(label);
    chip.dataset.kind = kind;
    chip.dataset.id = id;
    chip.dataset.need = String(need);
    wrap.append(chip);
    refs.push({ chip, label, kind, id, need });
  }
  return wrap;
}

function recipeCard(recipe, refs) {
  const article = element("article", "shop-seed kitchen-recipe");
  article.dataset.recipe = recipe.id;

  const head = element("div", "shop-seed__head");
  head.append(
    element("b", "", recipe.label),
    element("span", "", `${DISHES[recipe.dishId]?.sellPrice ?? 0} 金币 / 份`)
  );

  const copy = element(
    "p",
    "shop-seed__copy",
    recipe.description
  );

  const foot = element("div", "shop-seed__foot");
  const output = element(
    "span",
    "shop-seed__count",
    `成品 ${DISHES[recipe.dishId]?.label ?? ""}`
  );
  const cook = element("button", "shop-buy", "做一份");
  cook.type = "button";
  cook.dataset.cook = recipe.id;
  foot.append(output, cook);

  article.append(head, copy, ingredientChips(recipe, "produce", refs));
  if (Object.keys(recipe.goods).length) {
    article.append(ingredientChips(recipe, "goods", refs));
  }
  article.append(foot);
  return article;
}

function dishRow(dish) {
  const row = element("div", "panel-good kitchen-dish");
  row.dataset.dish = dish.id;
  row.hidden = true;

  const copy = element("div", "panel-good__copy");
  const name = element("span", "panel-good__name", dish.label);
  const meta = element("span", "panel-good__meta", "×0");
  copy.append(name, meta);

  const actions = element("div", "kitchen-dish__actions");
  const sell = element("button", "panel-task__button", "出售");
  sell.type = "button";
  sell.dataset.sell = dish.id;
  const serve = element("button", "panel-task__button", "留在桌上");
  serve.type = "button";
  serve.dataset.serve = dish.id;
  actions.append(sell, serve);

  row.append(copy, actions);
  return { row, meta, sell, serve };
}

/**
 * The stove modal. It renders the shared pantry, the three recipes and the
 * dishes already cooked. All mutations are dispatched as authoritative
 * actions; this module never touches game state directly.
 */
export function createKitchenPanel({ dispatch, getState, onClose = null }) {
  const panelEl = document.getElementById("kitchen-panel");
  const backdropEl = document.getElementById("kitchen-backdrop");
  const closeEl = document.getElementById("kitchen-close");
  const coinsEl = document.getElementById("kitchen-coins");
  const recipesEl = document.getElementById("kitchen-recipes");
  const dishesEl = document.getElementById("kitchen-dishes");
  const tableEl = document.getElementById("kitchen-table");
  const noteEl = document.getElementById("kitchen-note");

  const ingredientRefs = [];
  for (const recipeId of RECIPE_IDS) {
    recipesEl.append(recipeCard(RECIPES[recipeId], ingredientRefs));
  }

  const dishRows = new Map();
  for (const dishId of DISH_IDS) {
    const row = dishRow(DISHES[dishId]);
    dishRows.set(dishId, row);
    dishesEl.append(row.row);
  }
  const emptyDishesEl = element(
    "p",
    "panel-empty",
    "还没有做好的菜。先收获食材，再回灶台做一份。"
  );
  dishesEl.append(emptyDishesEl);

  let isOpen = false;
  let pendingUntil = 0;
  let lastTableKey = "";
  let lastSignature = "";
  let lastBusy = null;
  let lastFocus = null;

  function setOpen(next) {
    if (isOpen === next) return;
    isOpen = next;
    panelEl.hidden = !next;
    document.documentElement.classList.toggle("kitchen-open", next);
    if (next) {
      lastFocus = document.activeElement;
      for (const background of [
        document.getElementById("ui"),
        document.getElementById("label-layer"),
        document.getElementById("chat-dock"),
        document.querySelector(".panel-fab"),
        document.querySelector(".audio-fab")
      ]) {
        if (background) background.inert = true;
      }
      closeEl?.focus();
      sync(getState());
    } else {
      for (const background of [
        document.getElementById("ui"),
        document.getElementById("label-layer"),
        document.getElementById("chat-dock"),
        document.querySelector(".panel-fab"),
        document.querySelector(".audio-fab")
      ]) {
        if (background) background.inert = false;
      }
      lastSignature = "";
      lastBusy = null;
      lastFocus?.focus?.();
      lastFocus = null;
    }
  }

  function pending() {
    return performance.now() < pendingUntil;
  }

  function syncRecipes(state, busy) {
    const recipeCards = recipesEl.querySelectorAll("[data-recipe]");
    for (const card of recipeCards) {
      const recipe = RECIPES[card.dataset.recipe];
      if (!recipe) continue;
      const missing = recipeMissing(state, recipe);
      const cook = card.querySelector(`[data-cook="${recipe.id}"]`);
      if (cook) {
        cook.disabled = busy || !missing.ok;
        cook.textContent = !missing.ok
          ? "食材不够"
          : busy
            ? "正在做…"
            : "做一份";
      }
      for (const ref of ingredientRefs) {
        if (!card.contains(ref.chip)) continue;
        const have =
          ref.kind === "produce"
            ? Math.max(
                0,
                Math.floor(Number(state.inventory?.produce?.[ref.id]) || 0)
              )
            : Math.max(
                0,
                Math.floor(Number(state.inventory?.goods?.[ref.id]) || 0)
              );
        ref.label.textContent = `${
          (ref.kind === "produce" ? CROPS : GOODS)[ref.id]?.short ??
          (ref.kind === "produce" ? CROPS : GOODS)[ref.id]?.label ??
          ref.id
        } ${have}/${ref.need}`;
        ref.chip.classList.toggle("is-missing", have < ref.need);
      }
      card.classList.toggle("is-cookable", missing.ok);
    }
  }

  function syncDishes(state, busy) {
    let owned = 0;
    for (const dishId of DISH_IDS) {
      const entry = dishRows.get(dishId);
      const count = dishCount(state, dishId);
      if (!entry) continue;
      entry.row.hidden = count <= 0;
      if (count <= 0) continue;
      owned += 1;
      entry.meta.textContent = `×${count} · 单价 ${
        DISHES[dishId]?.sellPrice ?? 0
      } 金币`;
      entry.sell.disabled = busy;
      entry.sell.textContent = `出售 +${DISHES[dishId]?.sellPrice ?? 0}`;
      entry.serve.disabled = busy || Boolean(state.world?.meal);
      entry.serve.textContent = state.world?.meal ? "桌上已有饭" : "留在桌上";
    }
    emptyDishesEl.hidden = owned > 0;
    emptyDishesEl.textContent = state.world?.meal
      ? "菜已经端上桌了。"
      : "还没有做好的菜。先收获食材，再回灶台做一份。";
  }

  function syncTable(state) {
    const meal = state.world?.meal ?? null;
    const key = meal
      ? `${meal.dishId}:${meal.byId}:${meal.at}`
      : "empty";
    if (key === lastTableKey) return;
    lastTableKey = key;

    tableEl.replaceChildren();
    if (!meal) {
      tableEl.append(
        element(
          "p",
          "panel-empty",
          "桌上空着。把做好的菜留在桌上，对方回来就能看到。"
        )
      );
      return;
    }
    const dish = DISHES[meal.dishId];
    const row = element("div", "panel-good kitchen-table__meal");
    const copy = element("div", "panel-good__copy");
    copy.append(
      element("span", "panel-good__name", mealLabel(meal)),
      element(
        "span",
        "panel-good__meta",
        `${dish?.label ?? "饭菜"} · 走到餐桌坐下，两个人都坐好后点餐桌开饭`
      )
    );
    row.append(copy, element("span", "panel-scene__badge", "还热着"));
    tableEl.append(row);
  }

  function sync(state = getState()) {
    if (!state) return;
    const player = getActivePlayer(state);
    const shouldOpen = Boolean(
      state.ui.kitchenOpen && player?.currentScene === SCENE.INDOOR_1
    );
    setOpen(shouldOpen);
    if (!shouldOpen) return;

    const busy = pending();
    const signature = [
      state.ui?.kitchenOpen,
      player.id,
      player.currentScene,
      player.activity?.kind ?? "",
      player.activity?.slot ?? "",
      state.stats?.coins ?? 0,
      state.inventory?.produce,
      state.inventory?.dishes,
      state.world?.meal?.dishId ?? "",
      state.world?.meal?.byId ?? "",
      state.world?.meal?.at ?? 0
    ].map((value) => JSON.stringify(value)).join("|");
    if (signature === lastSignature && busy === lastBusy) return;
    lastSignature = signature;
    lastBusy = busy;

    const coins = Math.max(0, Math.floor(Number(state.stats?.coins) || 0));
    if (coinsEl) coinsEl.textContent = String(coins);
    syncRecipes(state, busy);
    syncDishes(state, busy);
    syncTable(state);

    if (noteEl) {
      const produceTotal = Object.values(state.inventory?.produce ?? {}).reduce(
        (sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)),
        0
      );
      const dishTotal = DISH_IDS.reduce(
        (sum, id) => sum + dishCount(state, id),
        0
      );
      noteEl.textContent = `食材 ${produceTotal} 份 · 菜品 ${dishTotal} 份 · 留饭会一直放到对方回来。`;
    }
  }

  function act(action, payload) {
    pendingUntil = performance.now() + 650;
    dispatch(action, null, payload);
  }

  recipesEl.addEventListener(
    "pointerdown",
    (event) => {
      const button = event.target.closest?.("[data-cook]");
      if (!button) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      act(ACTION.COOK_DISH, { recipeId: button.dataset.cook });
    },
    { passive: false }
  );

  dishesEl.addEventListener(
    "pointerdown",
    (event) => {
      const button = event.target.closest?.("[data-sell], [data-serve]");
      if (!button) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      if (button.dataset.sell) {
        act(ACTION.SELL_DISH, { dishId: button.dataset.sell });
      } else if (button.dataset.serve) {
        act(ACTION.SERVE_MEAL, { dishId: button.dataset.serve });
      }
    },
    { passive: false }
  );

  function close(event) {
    if (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
    }
    setOpen(false);
    onClose?.();
  }

  closeEl?.addEventListener("pointerdown", close, { passive: false });
  backdropEl?.addEventListener("pointerdown", close, { passive: false });

  // Pointer actions are handled on pointerdown (project convention). Native
  // Enter/Space activation produces a synthetic click with detail === 0; route
  // that separately so the modal is keyboard-operable without double-firing.
  panelEl.addEventListener("click", (event) => {
    if (!isOpen || event.detail !== 0) return;
    const button = event.target.closest?.("button");
    if (!button) return;
    if (button === closeEl) {
      close();
      return;
    }
    if (button.disabled) return;
    if (button.dataset.cook) {
      act(ACTION.COOK_DISH, { recipeId: button.dataset.cook });
    } else if (button.dataset.sell) {
      act(ACTION.SELL_DISH, { dishId: button.dataset.sell });
    } else if (button.dataset.serve) {
      act(ACTION.SERVE_MEAL, { dishId: button.dataset.serve });
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...panelEl.querySelectorAll("button:not([disabled])")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  return {
    sync,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => isOpen
  };
}
