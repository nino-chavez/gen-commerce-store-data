import { faker } from '@faker-js/faker';

const CATEGORIES = [
  { name: 'Phones', priceRange: { min: 100, max: 1500 } },
  { name: 'Laptops', priceRange: { min: 400, max: 3000 } },
  { name: 'Audio', priceRange: { min: 20, max: 500 } },
  { name: 'Gaming', priceRange: { min: 30, max: 800 } },
  { name: 'Smart Home', priceRange: { min: 15, max: 400 } },
  { name: 'Accessories', priceRange: { min: 5, max: 150 } },
];

const ATTRIBUTES = {
  Storage: ['64GB', '128GB', '256GB', '512GB', '1TB'],
  Color: ['Black', 'White', 'Silver', 'Space Grey', 'Midnight Blue', 'Rose Gold'],
};

const TAGS = ['New Release', 'Best Seller', 'Editor\'s Choice', 'On Sale', 'Bundle Deal', 'Refurbished'];

const ITEM_TYPES = {
  Phones: ['Smartphone', 'Phone Case', 'Screen Protector', 'Wireless Charger', 'Power Bank'],
  Laptops: ['Laptop', 'Laptop Stand', 'Docking Station', 'Laptop Sleeve', 'Webcam'],
  Audio: ['Headphones', 'Earbuds', 'Speaker', 'Soundbar', 'Microphone', 'DAC'],
  Gaming: ['Controller', 'Gaming Mouse', 'Mechanical Keyboard', 'Monitor', 'Headset', 'Capture Card'],
  'Smart Home': ['Smart Speaker', 'Smart Plug', 'Security Camera', 'Thermostat', 'Smart Light', 'Robot Vacuum'],
  Accessories: ['USB-C Cable', 'Hub', 'Mouse Pad', 'Stylus', 'Memory Card', 'Adapter'],
};

const BRAND_PREFIXES = [
  'Apex', 'Volta', 'Nexus', 'Pulse', 'Nova', 'Zenith',
  'Prism', 'Aero', 'Flux', 'Orbit',
];

function nameGenerator(category) {
  const items = ITEM_TYPES[category] || ITEM_TYPES['Accessories'];
  const brand = faker.helpers.arrayElement(BRAND_PREFIXES);
  const item = faker.helpers.arrayElement(items);
  const model = faker.string.alphanumeric(3).toUpperCase();
  return `${brand} ${item} ${model}`;
}

function descriptionGenerator(name, category) {
  const features = faker.helpers.arrayElements([
    'USB-C fast charging', 'Bluetooth 5.3', 'active noise cancellation',
    'OLED display', 'all-day battery life', 'Wi-Fi 6E support',
    'IP68 water resistance', 'Dolby Atmos', 'haptic feedback',
    'AI-powered processing', 'ultra-low latency', 'wireless connectivity',
  ], { min: 2, max: 4 });

  return `The ${name} delivers premium ${category.toLowerCase()} performance. ` +
    `Key features include ${features.join(', ')}. ` +
    faker.lorem.sentence();
}

export default {
  name: 'electronics',
  categories: CATEGORIES,
  attributes: ATTRIBUTES,
  tags: TAGS,
  priceRange: { min: 5, max: 3000 },
  nameGenerator,
  descriptionGenerator,
};
