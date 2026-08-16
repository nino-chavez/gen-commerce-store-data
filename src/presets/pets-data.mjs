// Shared taxonomy, brand, and pricing data for the `pets` preset.
// Split from presets/pets.mjs so both the generic single-item preset path
// (src/presets/pets.mjs) and the tiered bulk corpus generator
// (src/generators/pet-catalog.mjs) draw from one source of truth.

export const DEFAULT_SEED = 630071;

export const SPECIES = ['Dogs', 'Cats', 'Birds', 'Reptiles', 'Small Pets', 'Fish & Aquatics'];

export const DEPARTMENTS = ['Food', 'Treats', 'Toys & Enrichment', 'Health & Care', 'Gear & Habitat'];

// 3-5 sensible sub-categories per species x department.
export const SUBCATEGORIES = {
  Dogs: {
    Food: ['Dry Food', 'Wet Food', 'Fresh & Frozen', 'Veterinary Diets'],
    Treats: ['Training Treats', 'Dental Chews', 'Jerky & Meat Treats', 'Biscuits & Cookies'],
    'Toys & Enrichment': ['Chew Toys', 'Fetch Toys', 'Puzzle Toys', 'Rope Toys', 'Squeaky Toys'],
    'Health & Care': ['Flea & Tick Care', 'Grooming Supplies', 'Supplements & Vitamins', 'Dental Care', 'First Aid'],
    'Gear & Habitat': ['Collars & Leashes', 'Crates & Carriers', 'Beds & Furniture', 'Bowls & Feeders'],
  },
  Cats: {
    Food: ['Dry Food', 'Wet Food', 'Fresh & Frozen', 'Veterinary Diets', 'Kitten Formula'],
    Treats: ['Crunchy Treats', 'Soft & Chewy Treats', 'Dental Treats', 'Catnip Treats'],
    'Toys & Enrichment': ['Wand Toys', 'Scratching Toys', 'Puzzle Feeders', 'Catnip Toys'],
    'Health & Care': ['Flea & Tick Care', 'Grooming Supplies', 'Supplements & Vitamins', 'Litter & Waste Care'],
    'Gear & Habitat': ['Carriers & Travel', 'Scratching Posts & Trees', 'Beds & Furniture', 'Bowls & Feeders'],
  },
  Birds: {
    Food: ['Seed Mixes', 'Pellets', 'Fresh & Frozen', 'Nectar & Supplements'],
    Treats: ['Millet Sprays', 'Seed Treat Bars', 'Fruit & Nut Treats'],
    'Toys & Enrichment': ['Foraging Toys', 'Perches & Swings', 'Bells & Mirrors'],
    'Health & Care': ['Feather & Skin Care', 'Supplements & Vitamins', 'Mite & Parasite Care'],
    'Gear & Habitat': ['Cages & Stands', 'Perches & Play Gyms', 'Carriers & Travel'],
  },
  Reptiles: {
    Food: ['Live Feeders', 'Frozen Feeders', 'Pellets & Sticks', 'Supplements'],
    Treats: ['Feeder Treats', 'Calcium-Dusted Treats', 'Freeze-Dried Treats'],
    'Toys & Enrichment': ['Hides & Climbing Toys', 'Enrichment Branches', 'Basking Accessories'],
    'Health & Care': ['Shedding & Skin Care', 'Supplements & Vitamins', 'UVB & Heating Health'],
    'Gear & Habitat': ['Terrariums & Enclosures', 'Heating & Lighting', 'Substrate & Decor'],
  },
  'Small Pets': {
    Food: ['Pellets', 'Hay & Forage', 'Fresh & Frozen', 'Seed & Grain Mixes'],
    Treats: ['Yogurt Drops', 'Chew Sticks', 'Fruit & Veggie Treats'],
    'Toys & Enrichment': ['Chew Toys', 'Tunnels & Hideouts', 'Exercise Wheels'],
    'Health & Care': ['Grooming Supplies', 'Supplements & Vitamins', 'Nail & Dental Care'],
    'Gear & Habitat': ['Cages & Habitats', 'Bedding & Substrate', 'Carriers & Travel'],
  },
  'Fish & Aquatics': {
    Food: ['Flakes', 'Pellets', 'Frozen & Live Food', 'Algae Wafers'],
    Treats: ['Freeze-Dried Bloodworms', 'Treat Sticks', 'Color-Enhancing Treats'],
    'Toys & Enrichment': ['Tank Decor & Ornaments', 'Floating Toys', 'Enrichment Plants'],
    'Health & Care': ['Water Conditioners', 'Disease Treatment', 'Test Kits & Supplements'],
    'Gear & Habitat': ['Tanks & Aquariums', 'Filters & Pumps', 'Lighting & Heating'],
  },
};

// 36 invented brands, 6 per species, split value/mid/premium (2 each).
// None of these are real pet-brand names or lookalikes — see
// test/pet-catalog.test.mjs for the denylist collision check.
export const BRANDS = [
  { name: 'Northpaw Provisions', species: 'Dogs', positioning: 'value' },
  { name: 'Loyal Hound Supply Co.', species: 'Dogs', positioning: 'value' },
  { name: 'Trailhaven', species: 'Dogs', positioning: 'mid' },
  { name: 'Copper Bowl Co.', species: 'Dogs', positioning: 'mid' },
  { name: 'Ridgeline Naturals', species: 'Dogs', positioning: 'premium' },
  { name: 'Duskrun Reserve', species: 'Dogs', positioning: 'premium' },

  { name: 'Thistle & Sage', species: 'Cats', positioning: 'value' },
  { name: 'Whisker Fields', species: 'Cats', positioning: 'value' },
  { name: 'Amber Trail Co.', species: 'Cats', positioning: 'mid' },
  { name: 'Clovermeadow', species: 'Cats', positioning: 'mid' },
  { name: 'Silverbrook Cat Co.', species: 'Cats', positioning: 'premium' },
  { name: 'Velvet Ember', species: 'Cats', positioning: 'premium' },

  { name: 'Featherline', species: 'Birds', positioning: 'value' },
  { name: 'Duskwing Aviary Co.', species: 'Birds', positioning: 'value' },
  { name: 'Meadowlark Aviary', species: 'Birds', positioning: 'mid' },
  { name: 'Brightwing Naturals', species: 'Birds', positioning: 'mid' },
  { name: 'Highcrest Aviary', species: 'Birds', positioning: 'premium' },
  { name: 'Sunperch Reserve', species: 'Birds', positioning: 'premium' },

  { name: 'Sunbask Reptile Co.', species: 'Reptiles', positioning: 'value' },
  { name: 'Terrapoint', species: 'Reptiles', positioning: 'value' },
  { name: 'Scaleworks', species: 'Reptiles', positioning: 'mid' },
  { name: 'Duneridge Herp Co.', species: 'Reptiles', positioning: 'mid' },
  { name: 'Emberbask Herpetics', species: 'Reptiles', positioning: 'premium' },
  { name: 'Verdant Basilisk', species: 'Reptiles', positioning: 'premium' },

  { name: 'Burrowdale', species: 'Small Pets', positioning: 'value' },
  { name: 'Hutchcroft', species: 'Small Pets', positioning: 'value' },
  { name: 'Cloverwarren', species: 'Small Pets', positioning: 'mid' },
  { name: 'Thistlewick Small Pets', species: 'Small Pets', positioning: 'mid' },
  { name: 'Meadowburrow Reserve', species: 'Small Pets', positioning: 'premium' },
  { name: 'Willowden Naturals', species: 'Small Pets', positioning: 'premium' },

  { name: 'Bluefin Basics', species: 'Fish & Aquatics', positioning: 'value' },
  { name: 'Coral Current', species: 'Fish & Aquatics', positioning: 'value' },
  { name: 'Reeflight', species: 'Fish & Aquatics', positioning: 'mid' },
  { name: 'Tidewell Aquatics', species: 'Fish & Aquatics', positioning: 'mid' },
  { name: 'Azuremere Reserve', species: 'Fish & Aquatics', positioning: 'premium' },
  { name: 'Deepcurrent Elite', species: 'Fish & Aquatics', positioning: 'premium' },
];

// Base price range per department, before species/positioning multipliers.
export const DEPARTMENT_PRICE_RANGE = {
  Food: { min: 8, max: 65 },
  Treats: { min: 3, max: 25 },
  'Toys & Enrichment': { min: 4, max: 40 },
  'Health & Care': { min: 6, max: 50 },
  'Gear & Habitat': { min: 10, max: 250 },
};

// Species-level price multiplier (habitat-heavy species run costlier gear).
export const SPECIES_PRICE_MULTIPLIER = {
  Dogs: 1.0,
  Cats: 0.9,
  Birds: 0.8,
  Reptiles: 1.1,
  'Small Pets': 0.7,
  'Fish & Aquatics': 1.3,
};

// Brand positioning multiplier layered on top of the species multiplier.
export const POSITIONING_MULTIPLIER = {
  value: 0.75,
  mid: 1.0,
  premium: 1.4,
};

export const FOOD_SIZES = {
  Dogs: ['4 lb', '15 lb', '30 lb'],
  Cats: ['3 lb', '7 lb', '15 lb'],
  Birds: ['1 lb', '4 lb'],
  Reptiles: ['4 oz', '8 oz', '1 lb'],
  'Small Pets': ['2 lb', '5 lb', '10 lb'],
  'Fish & Aquatics': ['1 oz', '3 oz', '8 oz'],
};

export const FOOD_FLAVORS = {
  Dogs: ['Chicken & Rice', 'Beef & Barley', 'Salmon & Sweet Potato', 'Turkey & Pea', 'Lamb & Oatmeal'],
  Cats: ['Chicken & Rice', 'Salmon & Tuna', 'Turkey & Giblets', 'Duck & Pea', 'Ocean Whitefish'],
  Birds: ['Tropical Fruit Blend', 'Sunflower & Millet', 'Pellet Veggie Mix', 'Nut & Seed Medley'],
  Reptiles: ['Cricket & Mealworm', 'Leafy Greens Blend', 'Fruit & Insect Mix', 'Calcium-Fortified Pellets'],
  'Small Pets': ['Timothy Hay Blend', 'Alfalfa & Herb Mix', 'Veggie & Grain Blend', 'Orchard Grass Mix'],
  'Fish & Aquatics': ['Spirulina Flake Blend', 'Bloodworm & Brine Shrimp', 'Algae & Veggie Mix', 'Color-Enhancing Formula'],
};

export const GEAR_SIZES = {
  Dogs: ['Small', 'Medium', 'Large', 'X-Large'],
  Cats: ['Small', 'Medium', 'Large'],
  Birds: ['Small', 'Medium', 'Large'],
  Reptiles: ['10 Gallon', '20 Gallon', '40 Gallon', '75 Gallon'],
  'Small Pets': ['Small', 'Medium', 'Large'],
  'Fish & Aquatics': ['10 Gallon', '20 Gallon', '40 Gallon', '55 Gallon'],
};

export const GEAR_COLORS = ['Black', 'Grey', 'Navy', 'Forest Green', 'Sand', 'Berry Red'];

// Singular "owner" label used in generated description copy (avoids "dogs
// owners" / "fish & aquatics owners").
export const SPECIES_OWNER_LABEL = {
  Dogs: 'dog',
  Cats: 'cat',
  Birds: 'bird',
  Reptiles: 'reptile',
  'Small Pets': 'small-pet',
  'Fish & Aquatics': 'aquarium',
};

export const STYLE_DESCRIPTORS = {
  Food: ['Grain-Free', 'Limited Ingredient', 'High-Protein', 'Natural', 'Balanced'],
  Treats: ['Soft-Baked', 'Crunchy', 'Freeze-Dried', 'Low-Calorie', 'Grain-Free'],
  'Toys & Enrichment': ['Interactive', 'Durable', 'Plush', 'Enrichment', 'Tough'],
  'Health & Care': ['Advanced', 'Daily', 'Fast-Acting', 'Gentle', 'Complete'],
  'Gear & Habitat': ['Deluxe', 'Compact', 'All-Weather', 'Modular', 'Everyday'],
};

// Real-world pet brands (and close lookalikes) the invented BRANDS list
// must never collide with, checked in test/pet-catalog.test.mjs.
export const REAL_BRAND_DENYLIST = [
  'Purina', 'Pedigree', 'Royal Canin', 'Blue Buffalo', "Hill's Science Diet",
  'Iams', 'Eukanuba', 'Whiskas', 'Fancy Feast', 'Friskies', 'Tiki Cat',
  'Wellness', 'Merrick', 'Orijen', 'Acana', 'Taste of the Wild', 'Nutro',
  'Rachael Ray Nutrish', 'Kong', 'Nylabone', 'Greenies', 'Milk-Bone',
  'Zoo Med', 'Fluval', 'Aqueon', 'Tetra', 'Exo Terra', 'Zilla', 'Kaytee',
  'Oxbow', 'Vitakraft',
];

export function leafCategories() {
  const leaves = [];
  for (const species of SPECIES) {
    for (const department of DEPARTMENTS) {
      for (const subcategory of SUBCATEGORIES[species][department]) {
        leaves.push({ species, department, subcategory });
      }
    }
  }
  return leaves;
}

export function categoryPath(leaf) {
  return [leaf.species, leaf.department, leaf.subcategory];
}
