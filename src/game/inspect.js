/**
 * Flavour text for scenery that has no gameplay state. Keeping it in a pure
 * module lets the reducer stay authoritative without networking these taps.
 */
const INSPECT_TEXT = Object.freeze({
  shed:
    "工具棚里放着铲子、麻绳和旧花盆。门锁着，暂时不用进去。",
  well: "井水凉丝丝的，映着一小块天空。",
  compost: "堆肥正在慢慢发热，过些日子就能用了。",
  storage:
    "储物柜里放着干净的布、备用灯芯和一小盒种子袋。采集物会收进面板里的共享仓库。",
  pond: "水面很静，云影慢慢挪动，偶尔冒起细小的气泡。"
});

export function inspectText(targetId) {
  return Object.hasOwn(INSPECT_TEXT, targetId)
    ? INSPECT_TEXT[targetId]
    : "这里暂时没有什么特别的。";
}
