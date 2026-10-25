import { GOOD_IDS, GOODS } from "../config.js";

export function emptyGoods() {
  const goods = {};
  for (const id of GOOD_IDS) goods[id] = 0;
  return goods;
}

export function sanitizeGoods(raw) {
  const goods = {};
  for (const id of GOOD_IDS) {
    const value = Number(raw?.[id]);
    goods[id] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return goods;
}

export function cloneGoods(raw) {
  return sanitizeGoods(raw);
}

export function countGoods(goods) {
  return GOOD_IDS.reduce(
    (total, id) => total + Math.max(0, Math.floor(Number(goods?.[id]) || 0)),
    0
  );
}

export function goodsValue(id, count = 1) {
  const good = GOODS[id];
  if (!good) return 0;
  return Math.max(0, Math.floor(Number(count) || 0)) * good.sellPrice;
}

export function totalGoodsValue(goods) {
  return GOOD_IDS.reduce(
    (total, id) => total + goodsValue(id, goods?.[id]),
    0
  );
}
