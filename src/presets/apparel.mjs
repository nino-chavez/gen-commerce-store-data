import { faker } from '@faker-js/faker';

const CATEGORIES = [
  { name: 'Men', priceRange: { min: 20, max: 300 } },
  { name: 'Women', priceRange: { min: 20, max: 350 } },
  { name: 'Kids', priceRange: { min: 10, max: 80 } },
  { name: 'Shoes', priceRange: { min: 40, max: 400 } },
  { name: 'Accessories', priceRange: { min: 10, max: 200 } },
  { name: 'Activewear', priceRange: { min: 25, max: 150 } },
];

const ATTRIBUTES = {
  Size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  Color: ['Black', 'White', 'Navy', 'Grey', 'Olive', 'Burgundy', 'Cream', 'Denim Blue'],
};

const TAGS = ['New In', 'Best Seller', 'Trending', 'Sale', 'Sustainable', 'Essentials'];

const ITEM_TYPES = {
  Men: ['T-Shirt', 'Button-Down Shirt', 'Chinos', 'Jeans', 'Hoodie', 'Blazer', 'Polo', 'Shorts'],
  Women: ['Blouse', 'Dress', 'Skirt', 'Jeans', 'Cardigan', 'Jacket', 'Tank Top', 'Jumpsuit'],
  Kids: ['T-Shirt', 'Hoodie', 'Joggers', 'Shorts', 'Dress', 'Jacket', 'Overalls'],
  Shoes: ['Sneakers', 'Boots', 'Loafers', 'Sandals', 'Running Shoes', 'Oxford Shoes', 'Slides'],
  Accessories: ['Belt', 'Scarf', 'Hat', 'Sunglasses', 'Watch', 'Wallet', 'Bag', 'Socks Pack'],
  Activewear: ['Leggings', 'Sports Bra', 'Running Shorts', 'Training Tee', 'Track Jacket', 'Yoga Pants'],
};

const FABRIC_WORDS = [
  'Organic Cotton', 'Premium Linen', 'Merino Wool', 'Recycled Polyester',
  'French Terry', 'Stretch Denim', 'Cashmere Blend', 'Performance Nylon',
];

const STYLE_ADJECTIVES = [
  'Classic', 'Relaxed-Fit', 'Slim', 'Oversized', 'Tailored',
  'Vintage', 'Essential', 'Elevated', 'Heritage', 'Modern',
];

function nameGenerator(category) {
  const items = ITEM_TYPES[category] || ITEM_TYPES['Men'];
  const style = faker.helpers.arrayElement(STYLE_ADJECTIVES);
  const item = faker.helpers.arrayElement(items);
  return `${style} ${item}`;
}

function descriptionGenerator(name, category) {
  const fabric = faker.helpers.arrayElement(FABRIC_WORDS);
  const qualities = faker.helpers.arrayElements([
    'breathable fabric', 'reinforced stitching', 'wrinkle-resistant',
    'moisture-wicking', 'four-way stretch', 'garment-dyed finish',
    'flatlock seams', 'UPF 50+ protection', 'quick-dry technology',
  ], { min: 2, max: 3 });

  return `The ${name} is made from ${fabric.toLowerCase()} for ${category.toLowerCase()} who demand both comfort and style. ` +
    `Features ${qualities.join(', ')}. ` +
    faker.lorem.sentence();
}

export default {
  name: 'apparel',
  categories: CATEGORIES,
  attributes: ATTRIBUTES,
  tags: TAGS,
  priceRange: { min: 10, max: 400 },
  nameGenerator,
  descriptionGenerator,
};
