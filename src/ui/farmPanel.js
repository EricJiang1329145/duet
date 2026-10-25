import { ACTION, CROPS, CROP_IDS, FARM_SCENES } from "../config.js";
import {
  getCropConfig,
  getCropProgress,
  getCropRemainingMs,
  getCropStage,
  getPlotHazard
} from "../game/crop.js";
import {
  getCoins,
  getPlotUnlockCost,
  harvestReward
} from "../game/farmRules.js";
import { getActivePlayer } from "../game/player.js";
import { clockNow } from "../runtime/clock.js";

export function createFarmPanel({ dispatch, getState, onOpenShop = null }) {
  const hintEl = document.getElementById("hint");
  const panelEl = document.getElementById("plot-panel");
  const panelIdEl = document.getElementById("plot-panel-id");
  const cropNameEl = document.getElementById("plot-crop-name");
  const statusEl = document.getElementById("plot-status");
  const progressEl = document.getElementById("plot-progress");
  const progressFillEl = document.getElementById("plot-progress-fill");
  const actionButton = document.getElementById("plot-action");
  const closeButton = document.getElementById("plot-close");
  const seedRowEl = document.getElementById("seed-row");
  const shopButton = document.getElementById("plot-shop");
  const walletEl = document.getElementById("plot-wallet");

  let lastSignature = "";
  let isOpen = false;
  let selectedSeed = CROPS.radish.id;

  const seedButtons = new Map();
  for (const cropId of CROP_IDS) {
    const crop = CROPS[cropId];
    const button = document.createElement("button");
    button.className = "seed-chip";
    button.type = "button";
    button.dataset.crop = cropId;
    button.title = crop.description;

    const dot = document.createElement("span");
    dot.className = "seed-chip__dot";
    dot.style.background = crop.stem;
    const name = document.createElement("span");
    name.className = "seed-chip__name";
    name.textContent = crop.short;
    const count = document.createElement("b");
    count.className = "seed-chip__count";
    count.dataset.count = cropId;
    count.textContent = "0";

    button.append(dot, name, count);
    seedRowEl.append(button);
    seedButtons.set(cropId, button);
  }

  function setOpen(open) {
    if (isOpen === open) return;
    isOpen = open;

    if (open) {
      panelEl.hidden = false;
      hintEl.hidden = true;
      document.documentElement.classList.add("plot-panel-open");
    } else {
      panelEl.hidden = true;
      hintEl.hidden = false;
      document.documentElement.classList.remove("plot-panel-open");
      document.documentElement.style.removeProperty("--plot-panel-height");
      lastSignature = "";
    }
  }

  function measureAndPublishHeight() {
    if (panelEl.hidden) return;
    document.documentElement.style.setProperty(
      "--plot-panel-height",
      `${panelEl.offsetHeight}px`
    );
  }

  function syncSeedRow(state) {
    const seeds = state.inventory?.seeds ?? {};
    for (const cropId of CROP_IDS) {
      const button = seedButtons.get(cropId);
      const countEl = button.querySelector(`[data-count="${cropId}"]`);
      const count = Math.max(0, Math.floor(Number(seeds[cropId]) || 0));
      countEl.textContent = String(count);
      button.classList.toggle("is-selected", cropId === selectedSeed);
      button.classList.toggle("is-empty", count < 1);
    }
  }

  function sync(currentState, now = clockNow()) {
    const player = getActivePlayer(currentState);
    const selectedId = FARM_SCENES.has(player?.currentScene)
      ? currentState.ui.selectedPlotId
      : null;
    const plot = selectedId ? currentState.plots[selectedId] : null;

    if (!plot) {
      setOpen(false);
      return;
    }

    setOpen(true);

    const coins = getCoins(currentState);
    const crop = plot.crop ? getCropConfig(plot.crop.type) : null;
    const stage = getCropStage(plot, now);
    const hazard = getPlotHazard(plot, now);
    const progress = getCropProgress(plot, now);
    const progressPercent = Math.round(progress * 100);
    const remainingSeconds = Math.ceil(getCropRemainingMs(plot, now) / 1000);
    const unlocked = Boolean(plot.unlocked);
    const unlockCost = getPlotUnlockCost(selectedId);
    const reward = harvestReward(plot, currentState);

    let copy;
    if (!unlocked) {
      copy = {
        status: `这块地还没开垦 · 需要 ${unlockCost} 金币`,
        action: `开垦 · ${unlockCost} 金币`,
        stageKey: "unlock",
        disabled: coins < unlockCost
      };
    } else if (!plot.crop) {
      const seed = CROPS[selectedSeed];
      const seedCount = currentState.inventory?.seeds?.[selectedSeed] ?? 0;
      copy = {
        status: `空着 · 已选${seed.label} · 种子 ${seedCount} 颗`,
        action: "播种",
        stageKey: "empty",
        disabled: seedCount < 1
      };
    } else if (hazard) {
      copy = {
        status:
          hazard.kind === "pest"
            ? "有虫子，先捉掉才能收获。"
            : "长了杂草，先清理才能收获。",
        action: hazard.kind === "pest" ? "捉虫" : "清理杂草",
        stageKey: "hazard",
        disabled: false
      };
    } else {
      switch (stage) {
        case "seeded":
          copy = {
            status: "已播种，浇水后开始生长。",
            action: "浇水",
            stageKey: "seeded",
            disabled: false
          };
          break;
        case "sprout":
          copy = {
            status: `刚发芽 · 还需 ${remainingSeconds} 秒`,
            action: `成长中 · ${remainingSeconds}s`,
            stageKey: "growing",
            disabled: true
          };
          break;
        case "growing":
          copy = {
            status: `正在长大 · 还需 ${remainingSeconds} 秒`,
            action: `成长中 · ${remainingSeconds}s`,
            stageKey: "growing",
            disabled: true
          };
          break;
        case "ready":
          copy = {
            status: `成熟了 · 可卖 ${reward.coins} 金币${
              reward.seeds ? " + 1 颗种子" : ""
            }`,
            action: "收获",
            stageKey: "harvest",
            disabled: false
          };
          break;
        default:
          copy = {
            status: "空着，可以播种。",
            action: "播种",
            stageKey: "empty",
            disabled: true
          };
      }
    }

    const signature = [
      selectedId,
      unlocked,
      stage,
      hazard?.kind ?? "",
      selectedSeed,
      currentState.inventory?.seeds?.[selectedSeed] ?? 0,
      coins,
      crop?.id ?? "",
      copy.action
    ].join("|");

    if (signature !== lastSignature) {
      lastSignature = signature;
      panelIdEl.textContent = selectedId.slice(-2);
      cropNameEl.textContent = crop ? crop.label : "未开垦";
      statusEl.textContent = copy.status;
      actionButton.textContent = copy.action;
      actionButton.disabled = copy.disabled;
      actionButton.dataset.stage = copy.stageKey;
      if (walletEl) walletEl.textContent = `金币 ${coins}`;

      const showSeedRow = unlocked && !plot.crop;
      seedRowEl.hidden = !showSeedRow;
      if (showSeedRow) syncSeedRow(currentState);

      const showProgress =
        Boolean(plot.crop) &&
        (stage === "sprout" || stage === "growing" || stage === "ready");
      progressEl.hidden = !showProgress;
      progressFillEl.style.width = showProgress ? `${progressPercent}%` : "0%";

      requestAnimationFrame(measureAndPublishHeight);
    } else if (unlocked && !plot.crop) {
      // Seed counts can change from the shop while this panel stays open.
      syncSeedRow(currentState);
    }
  }

  function onActionPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const currentState = getState();
    const selectedId = currentState.ui.selectedPlotId;
    const plot = selectedId ? currentState.plots[selectedId] : null;
    if (!plot) return;

    if (!plot.unlocked) {
      dispatch(ACTION.UNLOCK_PLOT, selectedId, null);
      return;
    }

    const hazard = getPlotHazard(plot, clockNow());
    if (hazard) {
      dispatch(ACTION.CLEAR_HAZARD, selectedId, null);
      return;
    }

    const stage = getCropStage(plot, clockNow());
    if (stage === "empty") {
      dispatch(ACTION.PLANT_CROP, selectedId, { cropType: selectedSeed });
    } else if (stage === "seeded") {
      dispatch(ACTION.WATER_CROP, selectedId, {
        cropType: plot.crop?.type
      });
    } else if (stage === "ready") {
      dispatch(ACTION.HARVEST_CROP, selectedId, null);
    }
  }

  function onSeedPointerDown(event) {
    const button = event.target.closest?.("[data-crop]");
    if (!button) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectedSeed = button.dataset.crop;
    sync(getState());
  }

  function onClosePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch(ACTION.CLOSE_PLOT_PANEL, null, null);
  }

  function onShopPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenShop?.();
  }

  actionButton.addEventListener("pointerdown", onActionPointerDown, {
    passive: false
  });
  closeButton.addEventListener("pointerdown", onClosePointerDown, {
    passive: false
  });
  seedRowEl.addEventListener("pointerdown", onSeedPointerDown, {
    passive: false
  });
  shopButton?.addEventListener("pointerdown", onShopPointerDown, {
    passive: false
  });

  return {
    sync,
    refreshLayout: measureAndPublishHeight,
    isOpen: () => isOpen,
    getSelectedSeed: () => selectedSeed
  };
}
