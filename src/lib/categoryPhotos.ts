import type { HOME_TILES } from './discovery';

/** Category photos (owner-supplied, Nov 2026), used by the Home tiles and the first-launch intro. */
export const CATEGORY_PHOTOS: Record<(typeof HOME_TILES)[number], number> = {
  haircut: require('../../assets/images/categories/haircut.jpg'),
  braids: require('../../assets/images/categories/braids.jpg'),
  nails: require('../../assets/images/categories/nails.jpg'),
  eyelashes: require('../../assets/images/categories/eyelashes.jpg'),
  brows: require('../../assets/images/categories/brows.jpg'),
  makeup: require('../../assets/images/categories/makeup.jpg'),
};
