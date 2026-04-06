import { faker } from '@faker-js/faker';

const CATEGORIES = [
  { name: 'Living Room', priceRange: { min: 200, max: 3000 } },
  { name: 'Bedroom', priceRange: { min: 150, max: 2500 } },
  { name: 'Dining', priceRange: { min: 100, max: 2000 } },
  { name: 'Office', priceRange: { min: 80, max: 1500 } },
  { name: 'Outdoor', priceRange: { min: 100, max: 2000 } },
  { name: 'Kids', priceRange: { min: 50, max: 800 } },
];

const ATTRIBUTES = {
  Material: ['Oak', 'Walnut', 'Pine', 'Teak', 'Maple', 'Cherry', 'Bamboo', 'Metal', 'Rattan'],
  Color: ['Natural', 'White', 'Black', 'Espresso', 'Grey', 'Honey', 'Charcoal'],
  Size: ['Small', 'Medium', 'Large', 'Extra Large'],
};

const TAGS = ['New Arrival', 'Best Seller', 'Handcrafted', 'Sustainable', 'On Sale', 'Limited Edition'];

const ITEM_TYPES = {
  'Living Room': ['Sofa', 'Armchair', 'Coffee Table', 'TV Stand', 'Bookshelf', 'Side Table', 'Ottoman', 'Console Table'],
  Bedroom: ['Bed Frame', 'Nightstand', 'Dresser', 'Wardrobe', 'Vanity', 'Bench', 'Headboard'],
  Dining: ['Dining Table', 'Dining Chair', 'Buffet', 'Bar Stool', 'China Cabinet', 'Serving Cart'],
  Office: ['Desk', 'Office Chair', 'Filing Cabinet', 'Bookcase', 'Standing Desk', 'Credenza'],
  Outdoor: ['Patio Table', 'Lounge Chair', 'Garden Bench', 'Hammock', 'Pergola Set', 'Adirondack Chair'],
  Kids: ['Bunk Bed', 'Study Desk', 'Toy Chest', 'Bookshelf', 'Play Table', 'Rocking Chair'],
};

const STYLE_ADJECTIVES = [
  'Modern', 'Rustic', 'Mid-Century', 'Industrial', 'Scandinavian',
  'Farmhouse', 'Coastal', 'Minimalist', 'Bohemian', 'Contemporary',
];

function nameGenerator(category) {
  const items = ITEM_TYPES[category] || ITEM_TYPES['Living Room'];
  const style = faker.helpers.arrayElement(STYLE_ADJECTIVES);
  const item = faker.helpers.arrayElement(items);
  const collection = faker.person.lastName();
  return `${style} ${collection} ${item}`;
}

function descriptionGenerator(name, category) {
  const material = faker.helpers.arrayElement(ATTRIBUTES.Material);
  const features = faker.helpers.arrayElements([
    'handcrafted joinery', 'soft-close drawers', 'adjustable shelving',
    'solid wood construction', 'powder-coated steel frame', 'weather-resistant finish',
    'dovetail joints', 'natural grain patterns', 'ergonomic design',
    'sustainably sourced materials', 'easy assembly', 'premium upholstery',
  ], { min: 2, max: 4 });

  return `The ${name} brings effortless style to your ${category.toLowerCase()} space. ` +
    `Crafted from ${material.toLowerCase()}, it features ${features.join(', ')}. ` +
    faker.lorem.sentence();
}

export default {
  name: 'furniture',
  categories: CATEGORIES,
  attributes: ATTRIBUTES,
  tags: TAGS,
  priceRange: { min: 50, max: 3000 },
  nameGenerator,
  descriptionGenerator,
};
