import {
  ACTION,
  CROPS,
  CROP_IDS,
  DISHES,
  DISH_IDS,
  FARM_SCENES,
  GOODS,
  GOOD_IDS,
  PLOT_IDS,
  RECIPES,
  RECIPE_IDS,
  SCENE_RESOURCES,
  SCENE_UNLOCKS,
  SCENE_META,
  plotSceneFor
} from "../config.js";
import {
  getCropConfig,
  getCropProgress,
  getCropRemainingMs,
  getCropStage,
  getPlotHazard
} from "../game/crop.js";
import {
  canClaimGift,
  getCoins,
  getPlotUnlockCost,
  harvestReward
} from "../game/farmRules.js";
import { getActivePlayer } from "../game/player.js";
import { getDayKey, getSeason } from "../game/season.js";
import { isSceneUnlocked } from "../game/world.js";
import {
  canCookRecipe,
  dishCount,
  mealLabel,
  produceCount
} from "../game/kitchen.js";
import { clockNow } from "../runtime/clock.js";

const SCENE_LABELS = Object.freeze({
  outdoor: "小院",
  greenhouse: "温室",
  indoor_1: "一层",
  indoor_2: "二层"
});

function sceneLabel(scene) {
  return SCENE_LABELS[scene] ?? SCENE_META[scene]?.title ?? "别处";
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${String(seconds % 60).padStart(2, "0")} 秒`;
}

function text(tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (value !== undefined) el.textContent = value;
  return el;
}

function button(label, onPointerDown) {
  const el = document.createElement("button");
  el.className = "panel-task__button";
  el.type = "button";
  el.textContent = label;
  el.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onPointerDown();
  });
  return el;
}

/**
 * A local, read-only daily dashboard over the shared room state. It never
 * mutates plots or coins; the small actions dispatch the same public actions
 * as the world controls.
 */
export function createPanel({
  dispatch,
  getState,
  onSelectPlot = null,
  onOpenShop = null
}) {
  const toggleEl = document.getElementById("panel-toggle");
  const sheetEl = document.getElementById("panel-sheet");
  const backdropEl = document.getElementById("panel-backdrop");
  const closeEl = document.getElementById("panel-close");
  const shopEl = document.getElementById("panel-shop");
  const summaryEl = document.getElementById("panel-summary");
  const tasksEl = document.getElementById("panel-tasks");
  const cropsEl = document.getElementById("panel-crops");
  const seedsEl = document.getElementById("panel-seeds");
  const playersEl = document.getElementById("panel-players");
  const scenesEl = document.getElementById("panel-scenes");
  const storageEl = document.getElementById("panel-storage");
  const kitchenEl = document.getElementById("panel-kitchen");

  let open = false;
  let lastRenderAt = 0;

  function setOpen(next) {
    if (open === next) return;
    open = next;
    sheetEl.hidden = !open;
    toggleEl?.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("panel-open", open);
    if (open) {
      lastRenderAt = 0;
      render(clockNow());
    }
  }

  function focusPlot(plotId) {
    setOpen(false);
    onSelectPlot?.(plotId);
  }

  function openShop() {
    setOpen(false);
    onOpenShop?.();
  }

  function taskNode({ title, detail, tone = "", actionLabel = "", action = null }) {
    const row = text("div", `panel-task${tone ? ` is-${tone}` : ""}`);
    const copy = text("div", "panel-task__copy");
    copy.append(
      text("span", "panel-task__title", title),
      text("span", "panel-task__detail", detail)
    );
    row.append(copy);
    if (action && actionLabel) row.append(button(actionLabel, action));
    return row;
  }

  function emptyNode(copy) {
    return text("p", "panel-empty", copy);
  }

  function describePlayers(state) {
    const entries = Object.values(state.players ?? {}).filter(Boolean);
    playersEl.replaceChildren();
    for (const player of entries) {
      const row = text("div", "panel-player");
      const name = text(
        "span",
        "panel-player__name",
        `${player.id === state.activePlayerId ? "你" : "一起"} · ${player.name ?? "玩家"}`
      );
      const activity = player.activity?.kind;
      const extra =
        activity === "swing"
          ? "在秋千上"
          : activity === "seesaw"
            ? "在跷跷板上"
            : activity === "meal"
              ? "在餐桌旁"
              : activity === "sofa"
                ? "在沙发上"
                : sceneLabel(player.currentScene);
      const scene = text(
        "span",
        "panel-player__scene",
        `${sceneLabel(player.currentScene)}${activity ? ` · ${extra}` : ""}`
      );
      row.append(name, scene);
      playersEl.append(row);
    }
  }

  function render(now = clockNow()) {
    const state = getState();
    if (!state) return;
    const player = getActivePlayer(state);
    const currentScene = player?.currentScene ?? "outdoor";
    const season = getSeason(now);
    const coins = getCoins(state);
    const seeds = state.inventory?.seeds ?? {};

    const entries = PLOT_IDS.map((id) => {
      const plot = state.plots?.[id];
      if (!plot?.crop) return null;
      const crop = getCropConfig(plot.crop.type);
      const plotScene = plotSceneFor(state.world, id);
      const stage = getCropStage(plot, now);
      const hazard = getPlotHazard(plot, now);
      const remaining = getCropRemainingMs(plot, now);
      const reward = harvestReward(plot, state);
      return {
        id,
        plot,
        crop,
        scene: plotScene,
        stage,
        hazard,
        remaining,
        reward,
        canSelect:
          FARM_SCENES.has(currentScene) && plotScene === currentScene
      };
    }).filter(Boolean);

    const ready = entries.filter(
      (entry) => entry.stage === "ready" && !entry.hazard
    );
    const hazards = entries.filter((entry) => entry.hazard);
    const unwatered = entries.filter(
      (entry) => entry.plot.crop && !entry.plot.crop.wateredAt
    );
    const visibleFarmPlot = (id) =>
      FARM_SCENES.has(currentScene) &&
      plotSceneFor(state.world, id) === currentScene;
    const empty = PLOT_IDS.filter((id) => {
      const plot = state.plots?.[id];
      return visibleFarmPlot(id) && plot?.unlocked && !plot.crop;
    });
    const locked = PLOT_IDS.filter(
      (id) => visibleFarmPlot(id) && !state.plots?.[id]?.unlocked
    );
    const seedTotal = CROP_IDS.reduce(
      (total, id) => total + Math.max(0, Number(seeds[id]) || 0),
      0
    );
    const produceTotal = CROP_IDS.reduce(
      (total, id) => total + produceCount(state, id),
      0
    );
    const dishTotal = DISH_IDS.reduce(
      (total, id) => total + dishCount(state, id),
      0
    );

    summaryEl.replaceChildren(
      ...[
        ["金币", String(coins), "枚"],
        ["种子", String(seedTotal), "颗"],
        ["食材", String(produceTotal), "份"],
        ["菜品", String(dishTotal), "份"],
        ["可收获", String(ready.length), "块"],
        ["空地", String(empty.length), "块"],
        ["累计收获", String(state.stats?.harvested ?? 0), "次"],
        ["共餐", String(state.stats?.meals ?? 0), "次"]
      ].map(([label, value, unit]) => {
        const item = text("div", "panel-summary__item");
        item.append(
          text("span", "panel-summary__label", label),
          (() => {
            const strong = text("strong", "panel-summary__value", value);
            strong.append(text("small", "", ` ${unit}`));
            return strong;
          })()
        );
        return item;
      })
    );

    const tasks = [];
    const firstReady = ready.find((entry) => entry.canSelect);
    const firstHazard = hazards.find((entry) => entry.canSelect);
    const firstUnwatered = unwatered.find((entry) => entry.canSelect);

    if (ready.length) {
      tasks.push({
        title: `${ready.length} 块作物已经成熟`,
        detail: ready
          .slice(0, 2)
          .map((entry) => `${entry.id} ${entry.crop.short}`)
          .join("、"),
        actionLabel: firstReady ? "去收获" : "进温室查看",
        action: firstReady ? () => focusPlot(firstReady.id) : null
      });
    }
    if (hazards.length) {
      tasks.push({
        title: `${hazards.length} 块地有杂草/虫害`,
        detail: "先清理才能收获。",
        tone: "warn",
        actionLabel: firstHazard ? "去处理" : "",
        action: firstHazard ? () => focusPlot(firstHazard.id) : null
      });
    }
    if (unwatered.length) {
      tasks.push({
        title: `${unwatered.length} 块作物还没浇水`,
        detail: "浇水后才会开始生长。",
        actionLabel: firstUnwatered ? "去浇水" : "",
        action: firstUnwatered ? () => focusPlot(firstUnwatered.id) : null
      });
    }
    if (empty.length) {
      tasks.push({
        title: `${empty.length} 块空地可以播种`,
        detail: `当前有 ${seedTotal} 颗种子；种子铺可以补充。`,
        actionLabel: "打开种子铺",
        action: openShop
      });
    }
    const cookable = RECIPE_IDS.filter((id) => canCookRecipe(state, id));
    const meal = state.world?.meal ?? null;
    if (meal) {
      tasks.push({
        title: "桌上有一份饭",
        detail: `${mealLabel(meal)}。走到餐桌坐下，两个人都坐好后点餐桌开饭。`,
        tone: "warn"
      });
    } else if (dishTotal > 0) {
      tasks.push({
        title: `${dishTotal} 份做好的菜`,
        detail: "可以在灶台出售，或留一份在餐桌上等对方回来。",
        actionLabel: "",
        action: null
      });
    } else if (cookable.length) {
      tasks.push({
        title: `可以做${cookable
          .map((id) => DISHES[RECIPES[id].dishId]?.short ?? RECIPES[id].label)
          .join("、")}`,
        detail: "去一层厨房的灶台，用收获的食材做一份。",
        actionLabel: "",
        action: null
      });
    }

    if (canClaimGift(state, now)) {
      tasks.push({
        title: "今天的补给还没领",
        detail: "6 金币 + 2 颗小萝卜种子，每天一次。",
        tone: "warn",
        actionLabel: "领取",
        action: () => dispatch(ACTION.CLAIM_GIFT)
      });
    }
    if (!state.world?.greenhouse && coins >= 80) {
      tasks.push({
        title: "可以搭玻璃温室",
        detail: "覆盖 11/12 号田，收获多卖 25% 且必回种子。",
        actionLabel: "去种子铺",
        action: openShop
      });
    }
    const today = getDayKey(now);
    for (const unlock of Object.values(SCENE_UNLOCKS)) {
      if (!isSceneUnlocked(state.world, unlock.id)) {
        tasks.push({
          title: `可以解锁${unlock.title}`,
          detail: `${unlock.description} 入口在小院${unlock.entry}。`,
          actionLabel: `解锁 ${unlock.cost} 金币`,
          action: () => dispatch(ACTION.UNLOCK_SCENE, unlock.id, null, now)
        });
        continue;
      }
      const nodes = SCENE_RESOURCES[unlock.id] ?? [];
      const left = nodes.filter(
        (node) => state.world?.forage?.[node.id]?.[state.activePlayerId] !== today
      );
      if (left.length) {
        tasks.push({
          title: `${unlock.title}今天还有东西可采`,
          detail: `${left.map((node) => node.label).join("、")}，采完会放进仓库。`,
          actionLabel: "",
          action: null
        });
      }
    }
    if (locked.length && coins >= getPlotUnlockCost(locked[0])) {
      tasks.push({
        title: `还有 ${locked.length} 块地可以开垦`,
        detail: "开垦后可以种更多作物；温室的两块地在室内。",
        actionLabel: "查看田地",
        action: locked.length ? () => focusPlot(locked[0]) : null
      });
    }
    if (!tasks.length) {
      tasks.push({
        title: "暂时没有要赶的事",
        detail: "可以逛逛、聊天，或者攒金币解锁新的小场景。"
      });
    }

    tasksEl.replaceChildren(
      ...tasks.map((task) =>
        taskNode({
          ...task,
          action: task.action ?? null
        })
      )
    );

    cropsEl.replaceChildren();
    if (!entries.length) {
      cropsEl.append(emptyNode("还没有作物。先去种子铺买种子，再点田地播种。"));
    } else {
      const sorted = [...entries].sort((a, b) => {
        const rank = (entry) =>
          entry.hazard ? 0 : entry.stage === "ready" ? 1 : entry.stage === "seeded" ? 2 : 3;
        return rank(a) - rank(b) || a.id.localeCompare(b.id);
      });
      for (const entry of sorted) {
        const row = text(
          "div",
          `panel-crop${
            entry.stage === "ready" && !entry.hazard ? " is-ready" : ""
          }${entry.hazard ? " is-hazard" : ""}`
        );
        const top = text("div", "panel-crop__top");
        top.append(
          text(
            "span",
            "panel-crop__name",
            `${sceneLabel(entry.scene)} · ${entry.crop.short}`
          ),
          text(
            "span",
            "panel-crop__time",
            entry.hazard
              ? "需要清理"
              : entry.stage === "ready"
              ? "可以收获"
              : entry.plot.crop.wateredAt
                ? formatDuration(entry.remaining)
                : "未浇水"
          )
        );

        let status;
        if (entry.hazard) {
          status =
            entry.hazard.kind === "pest"
              ? "有虫害，先捉虫才能收获。"
              : "有杂草，先清理才能收获。";
        } else if (entry.stage === "ready") {
          status = `可卖 ${entry.reward.coins} 金币${
            entry.reward.seeds ? ` + ${entry.reward.seeds} 颗种子` : ""
          }`;
        } else if (!entry.plot.crop.wateredAt) {
          status = "已播种，浇水后开始生长。";
        } else {
          status = `还需约 ${formatDuration(entry.remaining)}，预计成熟后卖 ${entry.reward.coins} 金币。`;
        }

        const bar = text("div", "panel-crop__bar");
        const fill = text("span", "panel-crop__fill");
        fill.style.width = `${Math.round(getCropProgress(entry.plot, now) * 100)}%`;
        bar.append(fill);

        const view = button(entry.canSelect ? "查看田地" : "在别处", () => {});
        view.disabled = !entry.canSelect;
        view.addEventListener("pointerdown", (event) => {
          if (!entry.canSelect) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          focusPlot(entry.id);
        });

        row.append(top, text("span", "panel-crop__status", status), bar, view);
        cropsEl.append(row);
      }
    }

    seedsEl.replaceChildren();
    for (const cropId of CROP_IDS) {
      const crop = CROPS[cropId];
      const count = Math.max(0, Math.floor(Number(seeds[cropId]) || 0));
      const row = text("div", "panel-seed");
      const dot = text("span", "panel-seed__dot");
      dot.style.background = crop.stem;
      const copy = text("span", "panel-seed__name", crop.label);
      const meta = text(
        "span",
        "panel-seed__meta",
        `${crop.season === season.id ? "当季" : "反季"} · 卖 ${crop.sellPrice} · 种子 ${crop.seedCost} 金币`
      );
      copy.append(meta);
      const amount = text("span", "panel-seed__count", String(count));
      amount.append(text("small", "", " 颗"));
      row.append(dot, copy, amount);
      seedsEl.append(row);
    }

    describePlayers(state);

    scenesEl.replaceChildren();
    for (const unlock of Object.values(SCENE_UNLOCKS)) {
      const unlocked = isSceneUnlocked(state.world, unlock.id);
      const row = text("div", "panel-scene");
      const copy = text("div", "panel-scene__copy");
      copy.append(
        text("span", "panel-scene__title", unlock.title),
        text(
          "span",
          "panel-scene__detail",
          unlocked
            ? `已解锁 · 从${unlock.entry}进入 · 两人同场采集 +1`
            : `${unlock.description} · ${unlock.cost} 金币`
        )
      );
      row.append(copy);
      if (!unlocked) {
        const action = text(
          "button",
          "panel-task__button",
          `解锁 ${unlock.cost}`
        );
        action.type = "button";
        action.disabled = coins < unlock.cost;
        action.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (action.disabled) return;
          dispatch(ACTION.UNLOCK_SCENE, unlock.id, null, now);
        });
        row.append(action);
      } else {
        row.append(text("span", "panel-scene__badge", "已解锁"));
      }
      scenesEl.append(row);
    }

    if (kitchenEl) {
      kitchenEl.replaceChildren();
      const produceText =
        CROP_IDS.filter((id) => produceCount(state, id) > 0)
          .map((id) => `${CROPS[id].short} ×${produceCount(state, id)}`)
          .join("、") || "空";
      const dishText =
        DISH_IDS.filter((id) => dishCount(state, id) > 0)
          .map((id) => `${DISHES[id].short} ×${dishCount(state, id)}`)
          .join("、") || "还没有";
      const cookText = cookable.length
        ? cookable
            .map((id) => DISHES[RECIPES[id].dishId]?.short ?? RECIPES[id].label)
            .join("、")
        : "再攒一点食材就能开火。";
      for (const line of [
        `食材：${produceText}`,
        `菜品：${dishText}`,
        `现在能做：${cookText}`,
        meal ? `餐桌：${mealLabel(meal)}，还热着` : "餐桌：空着"
      ]) {
        kitchenEl.append(text("span", "panel-good__meta", line));
      }
    }

    const goods = state.inventory?.goods ?? {};
    const ownedGoods = GOOD_IDS.filter((id) => Number(goods[id]) > 0);
    storageEl.replaceChildren();
    if (!ownedGoods.length) {
      storageEl.append(
        emptyNode(
          "仓库现在是空的。去花间坡采野花和蜂巢，采集物会先放进这里，再按自己的节奏出售。种子仍然放在种子袋里，收获作物仍会直接结算金币。"
        )
      );
    } else {
      for (const id of ownedGoods) {
        const good = GOODS[id];
        const count = Math.max(0, Math.floor(Number(goods[id]) || 0));
        const row = text("div", "panel-good");
        const copy = text("div", "panel-good__copy");
        copy.append(
          text("span", "panel-good__name", good.label),
          text(
            "span",
            "panel-good__meta",
            `×${count} · 单价 ${good.sellPrice} 金币`
          )
        );
        const sell = text(
          "button",
          "panel-task__button",
          `全卖 ${good.sellPrice * count}`
        );
        sell.type = "button";
        sell.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          dispatch(ACTION.SELL_GOODS, id, { count }, now);
        });
        row.append(copy, sell);
        storageEl.append(row);
      }
    }
  }

  function sync(state = getState(), now = clockNow()) {
    if (!open) return;
    const elapsed = now - lastRenderAt;
    if (elapsed >= 0 && elapsed < 250) return;
    lastRenderAt = now;
    render(now);
  }

  toggleEl?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setOpen(!open);
  });
  backdropEl?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setOpen(false);
  });
  closeEl?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setOpen(false);
  });
  shopEl?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    openShop();
  });
  window.addEventListener("keydown", (event) => {
    if (open && event.key === "Escape") setOpen(false);
  });

  return {
    sync,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
    render
  };
}
