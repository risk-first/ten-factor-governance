import React from 'react';
import Link from '@docusaurus/Link';
import DownloadYamlButton from '@site/src/components/DownloadYamlButton';
import RevealItem from '@site/src/components/RevealItem';
import styles from './styles.module.css';

function textOf(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    if (value['reference-id']) {
      const entry = value['entry-id'] ? ` / ${value['entry-id']}` : '';
      return `${value['reference-id']}${entry}`;
    }
    if (Array.isArray(value)) {
      return value.map(textOf).filter(Boolean).join(', ');
    }
    return '';
  }
  return String(value).trim();
}

const GEMARA_MODEL_DOCS = {
  policy: 'policy',
  lexicon: 'lexicon',
  principle: 'principles-catalog',
  vector: 'vectors-catalog',
  guidance: 'guidance-catalog',
};

/**
 * Map a mapping-reference `file://` URL (relative to the YAML) onto a docs
 * route relative to the page rendering this document.
 *
 * Sibling ISO YAML (`file://aims-scope.yaml`) → sibling MDX (`./aims-scope`).
 * Shared model YAML under gemara/ (`file://../gemara/policy.yaml`) → gemara root pages.
 */
function docHrefFromFileUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('file://')) {
    return null;
  }
  const path = url.slice('file://'.length).replace(/^\.\//, '');

  const modelMatch = path.match(
    /^(?:\.\.\/)+(?:gemara\/)?(policy|lexicon|principle|vector|guidance)\.ya?ml$/i,
  );
  if (modelMatch) {
    const gemaraDoc = GEMARA_MODEL_DOCS[modelMatch[1]];
    return gemaraDoc ? `../gemara/${gemaraDoc}` : null;
  }

  const componentMatch = path.match(
    /^(?:\.\.\/)+gemara\/components\/(ai-portfolio-assistant|governance-runtime|artifact-repository)\/(capability|control|threat|risk)\.ya?ml$/i,
  );
  if (componentMatch) {
    const [, component, kind] = componentMatch;
    const page = {
      capability: 'capabilities-catalog',
      control: 'controls-catalog',
      threat: 'threats-catalog',
      risk: 'risks-catalog',
    }[kind];
    return page ? `../gemara/components/${component}/${page}` : null;
  }

  if (!path.includes('/') || !path.includes('..')) {
    const stem = path.split('/').pop().replace(/\.ya?ml$/i, '');
    return stem ? `./${stem}` : null;
  }

  return null;
}

function indexMappingReferences(metadata) {
  const byId = new Map();
  for (const ref of metadata?.['mapping-references'] ?? []) {
    if (ref?.id) {
      byId.set(ref.id, ref);
    }
  }
  return byId;
}

function MappingRefLink({id, mappingById}) {
  const mapping = mappingById.get(id);
  const href = mapping ? docHrefFromFileUrl(mapping.url) : null;
  const title = textOf(mapping?.title);

  if (!href) {
    return <code>{id}</code>;
  }

  return (
    <Link to={href} className={styles.refLink} title={title || undefined}>
      <code>{id}</code>
      {title ? <span className={styles.refTitle}>{title}</span> : null}
    </Link>
  );
}

const COLLECTION_KEYS = [
  'parties',
  'requirements',
  'objectives',
  'systems',
  'datasets',
  'resources',
  'tools',
  'suppliers',
  'contracts',
  'obligations',
  'issues',
  'inclusions',
  'exclusions',
  'interfaces',
  'decisions',
  'entries',
  'impacts',
  'audits',
  'incidents',
  'findings',
  'inputs',
  'attendees',
  'consultation',
  'commitments',
];

function itemTitle(item, index) {
  return (
    textOf(item.title) ||
    textOf(item.name) ||
    textOf(item.id) ||
    textOf(item.statement) ||
    `Item ${index + 1}`
  );
}

function ItemBody({item}) {
  const descriptionText =
    textOf(item.description) ||
    textOf(item.justification) ||
    textOf(item.purpose) ||
    textOf(item.summary) ||
    textOf(item.action) ||
    textOf(item['root-cause']?.statement);

  const extras = [];
  const maybeExtra = (label, value) => {
    const text = textOf(value);
    if (text) {
      extras.push([label, text]);
    }
  };
  maybeExtra('Kind', item.kind);
  maybeExtra('Category', item.category);
  maybeExtra('Origin', item.origin);
  maybeExtra('Source', item.source);
  maybeExtra('Stage', item.stage);
  maybeExtra('State', item.state);
  maybeExtra('Status', item.status);
  maybeExtra('Severity', item.severity);
  maybeExtra('Likelihood', item.likelihood);
  maybeExtra('Disposition', item.disposition);
  if (typeof item.applicable === 'boolean') {
    extras.push(['Applicable', item.applicable ? 'Yes' : 'No']);
  }
  maybeExtra('Roles', item.roles);
  maybeExtra('Type', item.type);

  return (
    <>
      {descriptionText ? (
        <p className={styles.bodyText}>{descriptionText}</p>
      ) : null}
      {extras.length > 0 ? (
        <dl className={styles.metaList}>
          {extras.map(([label, value]) => (
            <div key={label} className={styles.metaRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}

/**
 * Lightweight renderer for ISO management-system documents that are not
 * Gemara catalogs. Shows metadata, download, and expandable collection items.
 */
export default function IsoDocument({file}) {
  if (!file) {
    return (
      <p className={styles.empty}>
        <code>IsoDocument</code> requires a <code>file</code> prop.
      </p>
    );
  }

  const metadata = file.metadata ?? {};
  const collections = COLLECTION_KEYS.map((key) => ({
    key,
    items: Array.isArray(file[key]) ? file[key] : null,
  })).filter((entry) => entry.items && entry.items.length > 0);

  const isAimsProfile =
    metadata.type === 'AIMS' || (!metadata.type && file.scope && file.policy);

  const mappingById = indexMappingReferences(metadata);

  return (
    <div className={styles.doc}>
      <div className={styles.header}>
        <div className={styles.badges}>
          <span className={styles.badge}>
            {metadata.type ?? (isAimsProfile ? 'AIMS' : 'Document')}
          </span>
          {metadata.standard ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>
              {metadata.standard}
            </span>
          ) : null}
          {metadata.version ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>
              v{metadata.version}
            </span>
          ) : null}
          {metadata.draft ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>draft</span>
          ) : null}
        </div>
        <DownloadYamlButton file={file} />
      </div>

      {textOf(metadata.description) || textOf(file.statement) || textOf(file.purpose) ? (
        <div className={styles.frontMatter}>
          {textOf(metadata.description) ||
            textOf(file.statement) ||
            textOf(file.purpose)}
        </div>
      ) : null}

      {Array.isArray(file.clauses) && file.clauses.length > 0 ? (
        <p className={styles.clauses}>
          Clauses: {file.clauses.map((c) => (
            <code key={c} className={styles.clause}>{c}</code>
          ))}
        </p>
      ) : null}

      {isAimsProfile ? (
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>AIMS document references</h2>
          <ul className={styles.refList}>
            {Object.entries(file)
              .filter(([key]) => key !== 'title' && key !== 'metadata')
              .map(([key, value]) => {
                const refs = Array.isArray(value)
                  ? value
                  : value?.['reference-id']
                    ? [value]
                    : [];
                if (refs.length === 0) {
                  return null;
                }
                return (
                  <li key={key} className={styles.refItem}>
                    <strong className={styles.refSlot}>{key}</strong>
                    <span className={styles.refTargets}>
                      {refs.map((ref, index) => {
                        const id = ref['reference-id'];
                        if (!id) {
                          return null;
                        }
                        return (
                          <React.Fragment key={`${key}-${id}`}>
                            {index > 0 ? ', ' : null}
                            <MappingRefLink id={id} mappingById={mappingById} />
                          </React.Fragment>
                        );
                      })}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      {collections.map(({key, items}) => (
        <section key={key} className={styles.group} id={`group-${key}`}>
          <h2 className={styles.groupTitle}>
            {key.replace(/-/g, ' ')}
            <span className={styles.count}> ({items.length})</span>
          </h2>
          <div className={styles.itemList}>
            {items.map((item, index) => (
              <div key={item.id || `${key}-${index}`} id={item.id}>
                <RevealItem
                  title={
                    <>
                      {item.id ? (
                        <span className={styles.itemId}>{item.id}</span>
                      ) : null}
                      {itemTitle(item, index)}
                    </>
                  }
                >
                  <ItemBody item={item} />
                </RevealItem>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
