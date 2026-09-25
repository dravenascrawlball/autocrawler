import type { Item, ItemLookup } from './items';
import type { TownStorage } from './townStorage';
import { spendGold } from './townStorage';

/**
 * Buys `itemId` from the shop: deducts `ITEM_LOOKUP`-resolved item's price
 * from `townStorage.gold` and adds the item to `townStorage.items`. No-ops,
 * returning false, if gold is insufficient.
 */
export function buyShopItem(itemId: string, lookupItem: ItemLookup, townStorage: TownStorage): boolean {
  const item: Item = lookupItem(itemId);
  if (!spendGold(townStorage, item.price)) {
    return false;
  }

  townStorage.items.push(item);
  return true;
}
