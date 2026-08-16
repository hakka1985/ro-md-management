import type { ItemPrice } from "../../db/types";

// NPC fixed sell prices ported from the reference tool
// (https://github.com/d44aki-lang/RO-tools). These are the only items with
// a known fixed reference price; everything else starts at 0 and the user
// fills in their own expected sell price via ItemPriceManager.
export const itemPriceSeed: Omit<ItemPrice, "id">[] = [
  { itemName: "豪華な宝箱", expectedPrice: 1000000 },
  { itemName: "白金", expectedPrice: 124000 },
  { itemName: "金塊", expectedPrice: 62000 },
  { itemName: "銀塊", expectedPrice: 31000 },
  { itemName: "宝箱", expectedPrice: 186000 },
  { itemName: "DV&シャドウ", expectedPrice: 124000 },
];
