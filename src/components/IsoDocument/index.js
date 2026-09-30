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

function isReference(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value['reference-id'] === 'string' &&
    !value.id &&
    !value.title &&
    !value.name &&
    !value.description &&
    !value.statement &&
    !value.justification
  );
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

function MappingRefLink({id, entryId, mappingById}) {
  const mapping = mappingById.get(id);
  const href = mapping ? docHrefFromFileUrl(mapping.url) : null;
  const title = textOf(mapping?.title);
  const label = entryId ? (
    <>
      <code>{id}</code>
      <span className={styles.entryId}>/{entryId}</span>
    </>
  ) : (
    <code>{id}</code>
  );

  if (!href) {
    return (
      <span className={styles.refInline}>
        {label}
        {title ? <span className={styles.refTitle}>{title}</span> : null}
      </span>
    );
  }

  const anchor = entryId ? `#${entryId}` : '';
  return (
    <Link
      to={`${href}${anchor}`}
      className={styles.refLink}
      title={title || undefined}
    >
      {label}
      {title ? <span className={styles.refTitle}>{title}</span> : null}
    </Link>
  );
}

function ReferenceList({refs, mappingById}) {
  return (
    <div className={styles.itemList}>
      {refs.map((ref, index) => {
        const id = ref['reference-id'];
        if (!id) {
          return null;
        }
        const entryId = ref['entry-id'];
        const mapping = mappingById.get(id);
        const title = textOf(mapping?.title) || id;

        return (
          <div key={`${id}-${entryId || index}`} id={entryId || undefined}>
            <RevealItem
              title={
                <>
                  {entryId ? (
                    <span className={styles.itemId}>{entryId}</span>
                  ) : (
                    <span className={styles.itemId}>{id}</span>
                  )}
                  {title}
                </>
              }
            >
              <dl className={styles.metaList}>
                <div className={styles.metaRow}>
                  <dt>Source</dt>
                  <dd>
                    <MappingRefLink
                      id={id}
                      entryId={entryId}
                      mappingById={mappingById}
                    />
                  </dd>
                </div>
              </dl>
            </RevealItem>
          </div>
        );
      })}
    </div>
  );
}

/** Entity collections rendered as expandable cards. */
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

/**
 * Keys that may hold either entity rows or bare `#Reference` lists.
 * Scope `requirements` are references; stakeholder-requirement catalogs are
 * full entries. Detect per array so neither case renders as empty "Item N".
 */
const REFERENCE_OR_ENTITY_KEYS = new Set(['requirements']);

function splitReferenceOrEntityItems(items) {
  const refs = [];
  const entities = [];
  for (const item of items) {
    if (isReference(item)) {
      refs.push(item);
    } else {
      entities.push(item);
    }
  }
  return {refs, entities};
}

function itemTitle(item, index) {
  return (
    textOf(item.title) ||
    textOf(item.name) ||
    textOf(item.id) ||
    textOf(item.statement) ||
    `Item ${index + 1}`
  );
}

function ItemBody({item, mappingById}) {
  const descriptionText =
    textOf(item.description) ||
    textOf(item.justification) ||
    textOf(item.purpose) ||
    textOf(item.summary) ||
    textOf(item.action) ||
    textOf(item['root-cause']?.statement);

  const extras = [];
  const maybeExtra = (label, value) => {
    if (value == null || value === '') {
      return;
    }
    if (isReference(value)) {
      extras.push([
        label,
        <MappingRefLink
          key={label}
          id={value['reference-id']}
          entryId={value['entry-id']}
          mappingById={mappingById}
        />,
      ]);
      return;
    }
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
  maybeExtra('Direction', item.direction);
  maybeExtra('Effect', item.effect);
  maybeExtra('Counterparty', item.counterparty);
  maybeExtra('Responsibilities', item.responsibilities);
  maybeExtra('Governed elsewhere', item['governed-elsewhere']);
  maybeExtra('Target', item.target);
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
  const collections = [];
  const referenceLists = [];

  for (const key of COLLECTION_KEYS) {
    const items = Array.isArray(file[key]) ? file[key] : null;
    if (!items || items.length === 0) {
      continue;
    }
    if (REFERENCE_OR_ENTITY_KEYS.has(key)) {
      const {refs, entities} = splitReferenceOrEntityItems(items);
      if (refs.length > 0) {
        referenceLists.push({key, refs});
      }
      if (entities.length > 0) {
        collections.push({key, items: entities});
      }
      continue;
    }
    collections.push({key, items});
  }

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
                            <MappingRefLink
                              id={id}
                              entryId={ref['entry-id']}
                              mappingById={mappingById}
                            />
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

      {referenceLists.map(({key, refs}) => (
        <section key={key} className={styles.group} id={`group-${key}`}>
          <h2 className={styles.groupTitle}>
            {key.replace(/-/g, ' ')}
            <span className={styles.count}> ({refs.length})</span>
          </h2>
          <ReferenceList refs={refs} mappingById={mappingById} />
        </section>
      ))}

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
                  <ItemBody item={item} mappingById={mappingById} />
                </RevealItem>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
