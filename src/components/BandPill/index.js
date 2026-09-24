import React from 'react';
import {bandFrom} from '@site/src/data/bands';
import styles from './styles.module.css';

/**
 * Coloured badge for a governance lifecycle band, named by number (1–7),
 * key (`operate`), Gemara layer (`Layer 4`) or `cross`.
 */
export default function BandPill({band, layer, children}) {
  const resolved = bandFrom(band ?? layer);
  if (!resolved) {
    return null;
  }

  return (
    <span className={styles.pill} data-band={resolved.key} title={resolved.blurb}>
      {children ?? (
        <>
          <span className={styles.number}>{resolved.number ?? '×'}</span>
          {resolved.label}
        </>
      )}
    </span>
  );
}
