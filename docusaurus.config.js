/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Ten Factor Governance',
  tagline: 'A methodology for operable, auditable governance',
  favicon: 'img/favicon.ico',

  // GitHub pages deployment config
  url: 'https://10-factor-governance.netlify.app',
  baseUrl: '/',
  organizationName: 'robmoffat',
  projectName: 'ten-governance-factors',

  onBrokenLinks: 'warn',
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  plugins: [
    require.resolve('./src/plugins/category-listing'),
    // Lets MDX pages `import catalog from '@site/src/data/....yaml'`.
    // Attaches original YAML text for the Download YAML Source button.
    function yamlLoaderPlugin() {
      return {
        name: 'yaml-with-source-loader',
        configureWebpack() {
          return {
            module: {
              rules: [
                {
                  test: /\.ya?ml$/,
                  use: require.resolve('./src/plugins/yaml-with-source-loader.js'),
                },
              ],
            },
          };
        },
      };
    },
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Ten Factor Governance',
        logo: {
          alt: 'FINOS Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            href: 'https://riskfirst.org',
            label: 'Risk-First',
            position: 'right',
          },
          {
            href: 'https://www.finos.org',
            label: 'FINOS',
            position: 'right',
          },
          {
            href: 'https://ccc.finos.org',
            label: 'CCC',
            position: 'right',
          },
          {
            href: 'https://air-governance-framework.finos.org',
            label: 'AI Governance',
            position: 'right',
          },
          {
            href: 'https://openssf.org',
            label: 'OpenSSF',
            position: 'right',
          },
          {
            href: 'https://gemara.openssf.org',
            label: 'Gemara',
            position: 'right',
          },
          {
            href: 'https://calm.finos.org',
            label: 'CALM',
            position: 'right',
          },
          {
            href: 'https://github.com/risk-first/ten-factor-governance',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'The Factors',
                to: '/docs/factors/',
              },
              {
                label: 'Artifacts',
                to: '/docs/artifacts/',
              },
              {
                label: 'Tools',
                to: '/docs/tools/',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'FINOS',
                href: 'https://www.finos.org/',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/risk-first/ten-factor-governance',
              },
            ],
          },
          {
            title: 'Authors',
            items: [
              {
                label: 'Rob Moffat',
                href: 'https://robmoff.at',
              },
              {
                label: 'Eddie Knight',
                href: 'https://eddieknight.dev',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} FINOS / Rob Moffat`,
      },
      mermaid: {
        theme: {light: 'neutral', dark: 'dark'},
        options: {
          securityLevel: 'loose',
        },
      },
    }),
};

module.exports = config;
