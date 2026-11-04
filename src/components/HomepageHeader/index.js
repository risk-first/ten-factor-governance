import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from '@site/src/pages/index.module.css';

export default function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <p className={styles.eyebrow}>FINOS</p>
        <h1 className={styles.title}>{siteConfig.title}</h1>
        <p className={styles.subtitle}>
          A shared vocabulary for operable governance: activity-centred,
          machine-readable, continuous, and owned.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryCta} to="/docs/factors/">
            Explore the factors
          </Link>
          <Link className={styles.secondaryCta} to="/docs/artifacts/">
            Browse governance artifacts
          </Link>
          <Link className={styles.secondaryCta} to="/docs/tools/">
            Browse tools
          </Link>
          <a
            className={styles.secondaryCta}
            href="https://github.com/finos/ten-factor-governance/blob/main/examples/aipa/README.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Browse demo
          </a>
        </div>
      </div>
    </header>
  );
}
