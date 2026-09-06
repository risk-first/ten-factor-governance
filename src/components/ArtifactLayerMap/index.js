import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const GROUPS = [
  {
    key: 'definitions',
    label: 'Definitions',
    to: '/docs/artifacts/definitions/',
    toneClass: styles.groupDefinitions,
    items: [
      {to: '/docs/artifacts/definitions/principle', label: 'Principle'},
      {to: '/docs/artifacts/definitions/vector', label: 'Vector'},
      {to: '/docs/artifacts/definitions/guidance', label: 'Guidance'},
      {to: '/docs/artifacts/definitions/capability', label: 'Capability'},
      {to: '/docs/artifacts/definitions/threat', label: 'Threat'},
      {to: '/docs/artifacts/definitions/control', label: 'Control'},
      {to: '/docs/artifacts/definitions/risk', label: 'Risk'},
      {to: '/docs/artifacts/definitions/policy', label: 'Policy'},
      {to: '/docs/artifacts/definitions/raci', label: 'RACI'},
    ],
  },
  {
    key: 'activity',
    label: 'Activity',
    to: '/docs/artifacts/activity/',
    toneClass: styles.groupActivity,
    items: [
      {
        to: '/docs/artifacts/activity/',
        label: 'Sensitive Activity',
      },
    ],
  },
  {
    key: 'measures',
    label: 'Measures',
    to: '/docs/artifacts/measures/',
    toneClass: styles.groupMeasures,
    items: [
      {to: '/docs/artifacts/measures/evaluation-log', label: 'Evaluation Log'},
      {to: '/docs/artifacts/measures/enforcement-log', label: 'Enforcement Log'},
      {to: '/docs/artifacts/measures/audit-log', label: 'Audit Log'},
    ],
  },
];

/**
 * Three-band map of governance artifact groups with links into each page.
 */
export default function ArtifactLayerMap() {
  return (
    <div className={styles.map} role="img" aria-label="Governance artifact groups">
      {GROUPS.map((group, index) => (
        <React.Fragment key={group.key}>
          {index > 0 ? (
            <p className={styles.flowHint}>
              {index === 1 ? 'governs ↓' : 'measures ↓'}
            </p>
          ) : null}
          <div className={`${styles.band} ${group.toneClass}`}>
            <p className={styles.bandLabel}>
              <Link className={styles.bandLink} to={group.to}>
                {group.label}
              </Link>
            </p>
            <div className={styles.items}>
              {group.items.map((item) => (
                <Link key={item.to} className={styles.chip} to={item.to}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
