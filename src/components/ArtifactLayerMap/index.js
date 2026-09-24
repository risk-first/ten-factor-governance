import React from 'react';
import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import {BANDS, bandFromTags} from '@site/src/data/bands';
import styles from './styles.module.css';

/** Names an artifact goes by in one catalog, as a list. */
function namesIn(frontMatter, catalog) {
  const value = frontMatter?.aka?.[catalog];
  const names = Array.isArray(value) ? value : [value];
  return names.filter((name) => typeof name === 'string' && name.trim());
}

/**
 * What to call an artifact here: its catalog names when `filter` is set, else
 * the short sidebar label (or title) so example twins stay readable.
 */
function labelsFor(doc, catalog) {
  if (catalog) {
    return namesIn(doc.frontMatter, catalog);
  }
  const short =
    doc.frontMatter?.sidebar_label ||
    doc.frontMatter?.title ||
    doc.title;
  return short ? [short] : [];
}

/**
 * Map of governance documents stacked in lifecycle order.
 *
 * Document sets are selected by tag. Definition pages use `Artifact`; an
 * example twin (Gemara + AIMS mixed) uses its own set tag such as
 * `AI Portfolio Assistant`.
 *
 * @param {object} props
 * @param {string} [props.tag='Artifact'] - Document-set tag. Only pages carrying
 *   this tag are shown.
 * @param {string} [props.filter] - Optional `aka` key (`gemara`, `iso27001`,
 *   `iso42001`) to label chips by catalog name. Omit to use each page's
 *   sidebar label / title — typical for a mixed example twin.
 */
export default function ArtifactLayerMap({filter, tag = 'Artifact'}) {
  const listing = usePluginData('category-listing') ?? {};

  const chips = [...(listing[tag] ?? [])]
    .sort((a, b) => a.order - b.order)
    .flatMap((doc) =>
      labelsFor(doc, filter).map((name) => ({
        band: bandFromTags(doc.tags),
        name,
        permalink: doc.permalink,
      })),
    )
    .filter((chip) => chip.band);

  const bands = BANDS.map((band) => ({
    ...band,
    items: chips.filter((chip) => chip.band?.key === band.key),
  })).filter((band) => band.items.length > 0);

  if (bands.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.map}
      role="navigation"
      aria-label={`${tag} artifacts by layer`}
    >
      {bands.map((band) => (
        <div className={styles.band} key={band.key} data-band={band.key}>
          <p className={styles.bandLabel}>
            {band.number ? (
              <span className={styles.bandNumber}>{band.number}</span>
            ) : null}
            {band.label}
            <span className={styles.bandBlurb}>{band.blurb}</span>
          </p>
          <div className={styles.items}>
            {band.items.map((item) => (
              <Link
                key={`${item.name}-${item.permalink}`}
                className={styles.chip}
                to={item.permalink}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
