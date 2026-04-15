import { faker } from '@faker-js/faker';
import { createLogger } from '../logger.mjs';

const log = createLogger('content');

const PAGE_TITLES = [
  'About Us',
  'Shipping & Returns',
  'Size Guide',
  'Sustainability',
  'Contact Us',
  'FAQ',
  'Our Story',
  'Terms of Service',
  'Privacy Policy',
  'Careers',
];

function generatePage() {
  const title = faker.helpers.arrayElement(PAGE_TITLES);
  return {
    page: {
      title,
      body_html: `
        <h2>${title}</h2>
        <p>${faker.lorem.paragraphs(3, '</p><p>')}</p>
        <h3>${faker.lorem.sentence()}</h3>
        <p>${faker.lorem.paragraphs(2, '</p><p>')}</p>
      `.trim(),
      published: true,
    },
  };
}

function generateBlogPost() {
  const title = faker.lorem.sentence({ min: 4, max: 10 }).replace(/\.$/, '');
  return {
    article: {
      title,
      author: faker.person.fullName(),
      body_html: `
        <p>${faker.lorem.paragraphs(2, '</p><p>')}</p>
        <h3>${faker.lorem.sentence()}</h3>
        <p>${faker.lorem.paragraphs(3, '</p><p>')}</p>
        <blockquote><p>${faker.lorem.sentence()}</p></blockquote>
        <p>${faker.lorem.paragraphs(2, '</p><p>')}</p>
      `.trim(),
      tags: faker.helpers
        .arrayElements(
          ['style', 'trends', 'behind-the-scenes', 'sustainability', 'tips', 'news', 'lookbook'],
          faker.number.int({ min: 1, max: 3 }),
        )
        .join(', '),
      published: true,
    },
  };
}

/**
 * Seed Shopify pages and blog posts. Shopify-only.
 * `client` is a ShopifyClient (not a writer) because the payloads are
 * Shopify-shaped and there is no WC/BC equivalent.
 */
export async function seedContent(client, opts = {}) {
  const pageCount = opts.pages ?? 5;
  const blogPostCount = opts.blogPosts ?? 10;

  log.banner(`Seeding content (${pageCount} pages, ${blogPostCount} blog posts)`);

  const results = { pages: 0, blogPosts: 0, failed: 0 };

  // Pages
  const usedTitles = new Set();
  for (let i = 0; i < pageCount; i++) {
    let data = generatePage();
    while (usedTitles.has(data.page.title)) {
      data = generatePage();
    }
    usedTitles.add(data.page.title);

    try {
      const res = await client.post('/pages.json', data);
      log.success(`Page: ${res.page.title} [id: ${res.page.id}]`);
      results.pages++;
    } catch (err) {
      log.error(`Page ${i + 1}: ${err.message}`);
      results.failed++;
    }
    log.progress(i + 1, pageCount, 'pages');
  }

  // Blog posts — find or create a "News" blog
  let blogId;
  try {
    const blogs = await client.get('/blogs.json');
    if (blogs.blogs?.length > 0) {
      blogId = blogs.blogs[0].id;
      log.dim(`  Using existing blog: ${blogs.blogs[0].title}`);
    } else {
      const newBlog = await client.post('/blogs.json', { blog: { title: 'News' } });
      blogId = newBlog.blog.id;
      log.dim(`  Created blog: News`);
    }
  } catch (err) {
    log.error(`Could not get/create blog: ${err.message}`);
    return results;
  }

  for (let i = 0; i < blogPostCount; i++) {
    const data = generateBlogPost();
    try {
      const res = await client.post(`/blogs/${blogId}/articles.json`, data);
      log.success(`Article: ${res.article.title} [id: ${res.article.id}]`);
      results.blogPosts++;
    } catch (err) {
      log.error(`Article ${i + 1}: ${err.message}`);
      results.failed++;
    }
    log.progress(i + 1, blogPostCount, 'articles');
  }

  log.info(`\nDone: ${results.pages} pages, ${results.blogPosts} blog posts, ${results.failed} failed`);
  return results;
}
