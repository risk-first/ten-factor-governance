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

/** What to call an artifact here: its catalog names, or its own title. */
function labelsFor(doc, catalog) {
  if (!catalog) {
    return doc.title ? [doc.title] : [];
  }
  return namesIn(doc.frontMatter, catalog);
}

/**
 * Map of the artifacts in one catalog, stacked in governance lifecycle order.
 *
 * @param {object} props
 * @param {string} [props.filter] - `aka` key to select and label artifacts by,
 *   e.g. `gemara`, `iso27001` or `iso42001`. Artifacts without a name in that
 *   catalog are left out. Omit it for the whole catalogue under its own titles.
 * @param {string} [props.tag='Artifact']
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
    );

  const bands = BANDS.map((band) => ({
    ...band,
    items: chips.filter((chip) => chip.band?.key === band.key),
  })).filter((band) => band.items.length > 0);

  if (bands.length === 0) {
    return null;
  }

  return (
    <div className={styles.map} role="img" aria-label="Governance artifact bands">
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
