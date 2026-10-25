import { ACTION } from "../config.js";
import { writeFarmSave } from "../persistence/farmSave.js";
import { getActivePlayer } from "../game/player.js";
import { reducer } from "../game/reducer.js";

const NOTICE_DURATION_MS = 3400;

/**
 * Owns the authoritative local state and the event ingress. UI and rendering
 * never mutate state directly; they dispatch events or read snapshots.
 *
 * This module is the future network seam: remote events can be handed to
 * applyEvent() unchanged once a multiplayer transport is added.
 */
export function createGameSession({ initialState, onStateApplied = null }) {
  let state = initialState;
  let noticeTimerId = 0;

  function createEvent(action, targetId = null, payload = null) {
    const player = getActivePlayer(state);
    return {
      who: player?.id ?? null,
      when: Date.now(),
      action,
      targetId,
      payload
    };
  }

  function scheduleNoticeClear(notice) {
    window.clearTimeout(noticeTimerId);
    if (!notice) return;

    noticeTimerId = window.setTimeout(() => {
      applyEvent({
        who: null,
        when: Date.now(),
        action: ACTION.CLEAR_NOTICE,
        targetId: null,
        payload: { noticeId: notice.id }
      });
    }, NOTICE_DURATION_MS);
  }

  function applyEvent(incomingEvent) {
    if (!incomingEvent || typeof incomingEvent.action !== "string") {
      return state;
    }

    const event = {
      who: incomingEvent.who ?? null,
      when: Number.isFinite(incomingEvent.when)
        ? incomingEvent.when
        : Date.now(),
      action: incomingEvent.action,
      targetId: incomingEvent.targetId ?? null,
      payload: incomingEvent.payload ?? null
    };

    const previousState = state;
    const previousNoticeId = state.ui.notice?.id ?? null;
    const nextState = reducer(previousState, event);
    const nextNoticeId = nextState.ui.notice?.id ?? null;
    state = nextState;

    if (event.action === ACTION.FIELD_CLICKED) {
      console.log(`[Duet][田地] 格子 ID: ${event.targetId}`);
    }

    if (event.action === ACTION.READ_BOARD) {
      console.log(
        `[Duet][留言板] 打开留言板，共 ${nextState.board?.messages?.length ?? 0} 条留言。`
      );
    }

    if (event.action === ACTION.POST_MESSAGE && nextState !== previousState) {
      console.log(
        `[Duet][留言板] 新增留言，共 ${nextState.board?.messages?.length ?? 0} 条。`
      );
    }

    if (
      (event.action === ACTION.PLANT_CROP ||
        event.action === ACTION.WATER_CROP ||
        event.action === ACTION.HARVEST_CROP ||
        event.action === ACTION.CLEAR_HAZARD ||
        event.action === ACTION.UNLOCK_PLOT ||
        event.action === ACTION.BUY_SEED ||
        event.action === ACTION.BUY_GREENHOUSE ||
        event.action === ACTION.CLAIM_GIFT ||
        event.action === ACTION.RAIN_WATER ||
        event.action === ACTION.UNLOCK_SCENE ||
        event.action === ACTION.COLLECT_RESOURCE ||
        event.action === ACTION.SELL_GOODS ||
        event.action === ACTION.BUY_DECOR ||
        event.action === ACTION.REMOVE_DECOR ||
        event.action === ACTION.COOK_DISH ||
        event.action === ACTION.SELL_DISH ||
        event.action === ACTION.SERVE_MEAL ||
        event.action === ACTION.EAT_MEAL ||
        event.action === ACTION.POST_MESSAGE) &&
      nextState !== previousState
    ) {
      writeFarmSave(nextState);
    }

    if (nextNoticeId !== previousNoticeId) {
      scheduleNoticeClear(nextState.ui.notice);
    }

    onStateApplied?.({ previousState, state: nextState, event });
    return nextState;
  }

  function dispatch(action, targetId = null, payload = null) {
    return applyEvent(createEvent(action, targetId, payload));
  }

  function stop() {
    window.clearTimeout(noticeTimerId);
  }

  return {
    applyEvent,
    dispatch,
    getState: () => state,
    stop
  };
}
