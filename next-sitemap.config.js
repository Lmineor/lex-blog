/** @type {import('next-sitemap').IConfig} */

module.exports = {
  siteUrl: process.env.SITE_URL || "https://blog.mineor.xyz",
  generateRobotsTxt: true,
  sitemapSize: 7000,
};
