import type { NewNutritionalReference } from '../schema/index.js';

// Reference nutrition data, all per 100 g of the food as eaten (cooked/prepared).
// Loaded by `npm run db:seed`, which inserts new keys and updates existing ones, so values can be
// corrected here and re-seeded at any time. Keys must never be renamed once analyses refer to them.
//
// Two kinds of source:
// - USDA: generic foods, from USDA FoodData Central (SR Legacy).
// - VERIFY: Nigerian dishes, whose values vary a lot with the recipe. These are approximate and must
//   be checked against the FAO/INFOODS West African Food Composition Table (2019) before evaluation.
//
// Many of the Nigerian dishes, and their local names, come from the recipes at
// https://sisijemimah.com/category/nigerian-food-2/. The site gives ingredients but no nutrition
// facts, so the values for those dishes are approximate (VERIFY) too.

const USDA = 'USDA FoodData Central (SR Legacy)';
const VERIFY = 'Approximate; verify against FAO/INFOODS West African Food Composition Table (2019)';

type Macros = [calories: number, protein: number, carbohydrates: number, fat: number];

function food(
  key: string,
  foodName: string,
  aliases: string[],
  [calories, protein, carbohydrates, fat]: Macros,
  [typicalServingSize, typicalServingLabel]: [number, string],
  source: string,
): NewNutritionalReference {
  return {
    key,
    foodName,
    aliases,
    servingSize: 100,
    servingUnit: 'g',
    calories,
    protein,
    carbohydrates,
    fat,
    typicalServingSize,
    typicalServingLabel,
    source,
  };
}

// One row per line reads like a table, so keep Prettier from wrapping them.
// prettier-ignore
export const nutritionReferenceSeed: NewNutritionalReference[] = [
  // --- Nigerian rice and grain dishes ---
  food('jollof_rice', 'Jollof rice', ['jollof', 'party jollof', 'oven baked jollof rice', 'basmati jollof rice', 'coconut jollof rice'], [165, 3, 27, 5], [300, '1 plate'], VERIFY),
  food('fried_rice', 'Nigerian fried rice', ['fried rice', 'basmati fried rice', 'shrimp fried rice'], [170, 3.5, 26, 6], [300, '1 plate'], VERIFY),
  food('beans_porridge', 'Beans porridge', ['ewa', 'beans pottage', 'porridge beans'], [150, 7, 20, 5], [300, '1 plate'], VERIFY),
  food('yam_porridge', 'Yam porridge', ['asaro', 'yam pottage', 'yam and plantain pottage', 'coconut yam porridge'], [130, 2, 24, 3], [350, '1 plate'], VERIFY),
  food('moi_moi', 'Moi moi', ['moin moin', 'moimoi', 'bean pudding', 'oven baked moi moi'], [150, 8, 14, 7], [130, '1 wrap'], VERIFY),
  food('akara', 'Akara', ['bean cake', 'kosai', 'bean fritters'], [270, 12, 22, 15], [30, '1 ball'], VERIFY),
  food('pap', 'Pap', ['ogi', 'akamu', 'corn pap'], [45, 0.5, 10, 0.2], [300, '1 bowl'], VERIFY),
  food('coconut_rice', 'Coconut rice', ['coconut fried rice', 'ginger coconut rice'], [175, 3, 27, 6], [300, '1 plate'], VERIFY),
  food('native_jollof_rice', 'Native jollof rice', ['iwuk edesi', 'palm oil rice', 'concoction rice'], [170, 3.5, 25, 6.5], [300, '1 plate'], VERIFY),
  food('ofada_rice', 'Ofada rice, boiled', ['ofada', 'unpolished rice', 'local rice'], [123, 2.7, 25.6, 1], [250, '1 plate'], VERIFY),
  food('jollof_spaghetti', 'Jollof spaghetti', ['spaghetti jollof', 'pasta in tomato sauce'], [160, 4.5, 25, 4.5], [300, '1 plate'], VERIFY),
  food('adalu', 'Adalu', ['beans and corn', 'beans and corn pottage'], [140, 6, 21, 4], [300, '1 plate'], VERIFY),
  food('plantain_pottage', 'Plantain pottage', ['plantain porridge', 'ripe plantain pottage', 'unripe plantain pottage'], [130, 1.5, 24, 3.5], [350, '1 plate'], VERIFY),
  food('ikokore', 'Ikokore', ['water yam pottage', 'water yam porridge'], [130, 4, 20, 4], [350, '1 plate'], VERIFY),
  food('ekuru', 'Ekuru', ['white moi moi', 'ofuloju'], [110, 8, 17, 0.8], [150, '1 wrap'], VERIFY),
  food('abacha', 'Abacha', ['african salad', 'abacha and ugba', 'ugba'], [230, 5, 30, 10.5], [250, '1 plate'], VERIFY),

  // --- Swallows ---
  food('eba', 'Eba', ['garri', 'gari'], [160, 0.5, 38, 0.3], [250, '1 wrap'], VERIFY),
  food('pounded_yam', 'Pounded yam', ['iyan'], [120, 1.5, 28, 0.2], [250, '1 wrap'], VERIFY),
  food('amala', 'Amala', ['yam flour swallow'], [115, 1.5, 27, 0.2], [250, '1 wrap'], VERIFY),
  food('fufu', 'Fufu', ['akpu', 'cassava fufu'], [150, 0.5, 37, 0.2], [250, '1 wrap'], VERIFY),
  food('semovita', 'Semovita', ['semo', 'semolina swallow'], [120, 3.5, 25, 0.3], [250, '1 wrap'], VERIFY),
  food('tuwo_shinkafa', 'Tuwo shinkafa', ['tuwo', 'rice tuwo'], [120, 2.3, 26.5, 0.2], [250, '1 wrap'], VERIFY),

  // --- Soups and stews ---
  food('egusi_soup', 'Egusi soup', ['egusi', 'melon soup', 'efo elegusi', 'egusi ijebu'], [200, 9, 5, 16], [250, '1 bowl'], VERIFY),
  food('okra_soup', 'Okra soup', ['okro soup', 'okra', 'okro', 'ila alasepo', 'otong soup', 'seafood okra'], [80, 5, 5, 4.5], [250, '1 bowl'], VERIFY),
  food('efo_riro', 'Efo riro', ['vegetable soup', 'efo', 'kale efo riro'], [120, 6, 5, 9], [250, '1 bowl'], VERIFY),
  food('ogbono_soup', 'Ogbono soup', ['ogbono', 'draw soup', 'ogbono okra soup'], [180, 8, 5, 14], [250, '1 bowl'], VERIFY),
  food('pepper_soup', 'Pepper soup', ['goat meat pepper soup', 'fish pepper soup', 'assorted meat pepper soup', 'chicken pepper soup', 'turkey pepper soup'], [70, 9, 2, 3], [350, '1 bowl'], VERIFY),
  food('tomato_stew', 'Tomato stew', ['red stew', 'stew', 'obe ata', 'chicken stew'], [120, 1.5, 6, 10], [100, '1 serving spoon'], VERIFY),
  food('edikang_ikong', 'Edikang ikong soup', ['edikaikong', 'edikang ikong'], [150, 9, 5, 11], [250, '1 bowl'], VERIFY),
  food('afang_soup', 'Afang soup', ['afang'], [140, 9, 5, 9.5], [250, '1 bowl'], VERIFY),
  food('ewedu_soup', 'Ewedu soup', ['ewedu', 'jute leaf soup'], [30, 2.5, 3.5, 0.6], [150, '1 serving'], VERIFY),
  food('gbegiri_soup', 'Gbegiri soup', ['gbegiri', 'bean soup', 'miyan wake'], [110, 5.5, 13, 4], [200, '1 serving'], VERIFY),
  food('banga_soup', 'Banga soup', ['banga', 'ofe akwu', 'palm nut soup'], [220, 7, 6, 19], [250, '1 bowl'], VERIFY),
  food('groundnut_soup', 'Groundnut soup', ['omisagwe', 'peanut soup', 'miyan gyada'], [190, 9, 7, 14], [250, '1 bowl'], VERIFY),
  food('ofe_nsala', 'Ofe nsala', ['nsala soup', 'white soup'], [90, 9, 6, 3.5], [250, '1 bowl'], VERIFY),
  food('ofe_owerri', 'Ofe owerri', ['owerri soup'], [130, 9, 5, 8.5], [250, '1 bowl'], VERIFY),
  food('bitter_leaf_soup', 'Bitter leaf soup', ['ofe onugbu', 'onugbu soup'], [120, 7, 7, 7], [250, '1 bowl'], VERIFY),
  food('oha_soup', 'Oha soup', ['ofe oha', 'ora soup'], [120, 7, 7, 7], [250, '1 bowl'], VERIFY),
  food('buka_stew', 'Buka stew', ['obe ata dindin', 'palm oil stew', 'lafenwa stew', 'itoko stew', 'ofada sauce', 'obe ata iru', 'locust beans stew'], [210, 2, 8, 19], [100, '1 serving spoon'], VERIFY),
  food('ayamase', 'Ayamase', ['ofada stew', 'green ofada stew'], [190, 7, 5, 16], [100, '1 serving spoon'], VERIFY),
  food('pepper_sauce', 'Fried pepper sauce', ['ata dindin', 'pepper sauce'], [180, 1.5, 8, 16], [100, '1 serving spoon'], VERIFY),
  food('agoyin_sauce', 'Agoyin sauce', ['ewa agoyin sauce', 'agoyin stew'], [400, 1.5, 8, 40], [40, '2 tablespoons'], VERIFY),
  food('garden_egg_stew', 'Garden egg stew', ['garden egg sauce', 'eggplant stew'], [110, 3, 7, 8], [100, '1 serving spoon'], VERIFY),
  food('egg_stew', 'Egg stew', ['egg sauce', 'stewed eggs'], [140, 6, 5, 11], [100, '1 serving spoon'], VERIFY),
  food('fish_stew', 'Fish stew', ['obe eja dindin', 'mackerel stew', 'titus stew', 'fish sauce'], [150, 9, 5, 10.5], [100, '1 serving spoon'], VERIFY),

  // --- Plantain, yam and tubers ---
  food('fried_plantain', 'Fried plantain', ['dodo', 'plantain fried'], [270, 1.3, 40, 12], [150, '1 portion'], VERIFY),
  food('roasted_plantain', 'Roasted plantain', ['boli', 'bole'], [135, 1.3, 32, 0.4], [200, '1 plantain'], VERIFY),
  food('plantain_boiled', 'Plantain, boiled', ['boiled plantain'], [116, 0.8, 31.2, 0.2], [200, '1 plantain'], USDA),
  food('yam_boiled', 'Yam, boiled', ['boiled yam'], [116, 1.5, 27.5, 0.1], [250, '2 slices'], USDA),
  food('fried_yam', 'Fried yam', ['dundun', 'yam chips'], [240, 1.8, 35, 11], [200, '1 portion'], VERIFY),
  food('sweet_potato_boiled', 'Sweet potato, boiled', ['sweet potato'], [76, 1.4, 17.7, 0.1], [150, '1 medium'], USDA),
  food('potato_boiled', 'Potato, boiled', ['irish potato', 'boiled potato'], [87, 1.9, 20.1, 0.1], [150, '1 medium'], USDA),
  food('french_fries', 'French fries', ['chips', 'fries'], [312, 3.4, 41, 15], [120, '1 medium portion'], USDA),
  food('ojojo', 'Ojojo', ['water yam fritters', 'yam fritters'], [250, 3, 30, 13], [30, '1 fritter'], VERIFY),
  food('yamarita', 'Yamarita', ['dundun oniyeri', 'egg-coated fried yam'], [230, 4, 30, 10.5], [200, '1 portion'], VERIFY),
  food('plantain_chips', 'Plantain chips', ['igbekere', 'kpekere'], [531, 2.3, 63.8, 29.6], [50, '1 small pack'], VERIFY),

  // --- Meat, fish and eggs ---
  food('suya', 'Suya', ['beef suya', 'kilishi'], [250, 28, 4, 13], [100, '1 stick'], VERIFY),
  food('chicken_fried', 'Chicken, fried (with skin)', ['fried chicken'], [246, 27, 3, 14], [150, '1 piece'], VERIFY),
  food('chicken_breast_roasted', 'Chicken breast, roasted (no skin)', ['grilled chicken', 'chicken breast'], [165, 31, 0, 3.6], [120, '1 breast'], USDA),
  food('beef_stewed', 'Beef, stewed', ['beef', 'meat', 'stewed beef'], [250, 26, 0, 15], [80, '2 pieces'], VERIFY),
  food('goat_meat', 'Goat meat, cooked', ['goat meat', 'chevon'], [143, 27, 0, 3], [100, '2 pieces'], USDA),
  food('tilapia_cooked', 'Tilapia, cooked', ['tilapia', 'fish', 'grilled tilapia', 'grilled fish'], [128, 26.2, 0, 2.7], [150, '1 fish'], USDA),
  food('catfish_cooked', 'Catfish, cooked', ['catfish', 'point and kill'], [105, 18.5, 0, 2.9], [150, '1 portion'], USDA),
  food('egg_boiled', 'Egg, boiled', ['boiled egg', 'egg'], [155, 12.6, 1.1, 10.6], [50, '1 egg'], USDA),
  food('egg_fried', 'Egg, fried', ['fried egg', 'omelette'], [196, 13.6, 0.8, 14.8], [50, '1 egg'], USDA),
  food('chicken_suya', 'Chicken suya', ['chicken suya kebab', 'chicken skewers'], [190, 27, 3, 8], [100, '1 skewer'], VERIFY),
  food('peppered_chicken', 'Peppered chicken', ['party chicken', 'chicken in pepper sauce'], [240, 24, 4, 14], [150, '1 piece'], VERIFY),
  food('peppered_gizzard', 'Peppered gizzard', ['gizzard', 'chicken gizzard'], [190, 22, 4, 9.5], [100, '1 portion'], VERIFY),
  food('gizdodo', 'Gizdodo', ['gizzard and dodo', 'yamgizdodo'], [210, 10, 22, 9.5], [250, '1 plate'], VERIFY),
  food('asun', 'Asun', ['peppered goat meat', 'spicy goat meat'], [230, 25, 4, 13], [150, '1 portion'], VERIFY),
  food('nkwobi', 'Nkwobi', ['spicy cow foot', 'cow foot'], [210, 18, 3, 14], [250, '1 bowl'], VERIFY),
  food('peppered_assorted_meat', 'Peppered assorted meat', ['assorted meat', 'peppered meat', 'orisirisi'], [220, 22, 3, 13.5], [150, '1 portion'], VERIFY),
  food('scotch_egg', 'Scotch egg', ['scotch eggs'], [240, 12, 15, 15], [120, '1 egg'], VERIFY),

  // --- Snacks ---
  food('puff_puff', 'Puff-puff', ['puff puff', 'bofrot'], [330, 6, 45, 14], [25, '1 ball'], VERIFY),
  food('meat_pie', 'Meat pie', ['pie'], [290, 7, 30, 16], [120, '1 pie'], VERIFY),
  food('chicken_pie', 'Chicken pie', [], [280, 8, 28, 15], [120, '1 pie'], VERIFY),
  food('doughnut', 'Doughnut', ['donut', 'nigerian doughnut'], [400, 6.5, 47, 21], [70, '1 doughnut'], VERIFY),
  food('chin_chin', 'Chin chin', ['chinchin'], [480, 7, 60, 23], [50, '1 small pack'], VERIFY),
  food('groundnuts_roasted', 'Groundnuts, roasted', ['peanuts', 'groundnut'], [585, 23.7, 21.5, 49.7], [30, '1 handful'], USDA),

  // --- Staples and breakfast ---
  food('white_rice_cooked', 'White rice, cooked', ['rice', 'plain rice', 'boiled rice'], [130, 2.7, 28.2, 0.3], [250, '1 plate'], USDA),
  food('spaghetti_cooked', 'Spaghetti, cooked', ['pasta', 'spaghetti'], [158, 5.8, 30.9, 0.9], [250, '1 plate'], USDA),
  food('white_bread', 'White bread', ['bread', 'agege bread', 'sliced bread'], [265, 9, 49, 3.2], [60, '2 slices'], USDA),
  food('beans_boiled', 'Beans (cowpeas), boiled', ['cowpeas', 'black-eyed peas', 'boiled beans', 'ewa agoyin', 'agoyin beans'], [116, 7.7, 20.8, 0.5], [200, '1 cup'], USDA),
  food('oatmeal_cooked', 'Oatmeal, cooked with water', ['oats', 'porridge oats'], [71, 2.5, 12, 1.5], [250, '1 bowl'], USDA),
  food('cornflakes', 'Corn flakes', ['cornflakes', 'cereal'], [357, 7.5, 84, 0.4], [30, '1 bowl (dry)'], USDA),

  // --- Fruit ---
  food('banana', 'Banana', [], [89, 1.1, 22.8, 0.3], [120, '1 medium'], USDA),
  food('apple', 'Apple', [], [52, 0.3, 13.8, 0.2], [180, '1 medium'], USDA),
  food('orange', 'Orange', [], [47, 0.9, 11.8, 0.1], [130, '1 medium'], USDA),
  food('watermelon', 'Watermelon', [], [30, 0.6, 7.6, 0.2], [280, '1 slice'], USDA),
  food('pineapple', 'Pineapple', [], [50, 0.5, 13.1, 0.1], [165, '1 cup'], USDA),
  food('avocado', 'Avocado', ['pear'], [160, 2, 8.5, 14.7], [150, '1 fruit'], USDA),

  // --- Drinks ---
  food('milk_whole', 'Milk, whole', ['milk'], [61, 3.2, 4.8, 3.3], [250, '1 glass'], USDA),
  food('cola', 'Cola soft drink', ['coke', 'soda', 'soft drink'], [42, 0, 10.6, 0], [350, '1 bottle (35 cl)'], USDA),
];
