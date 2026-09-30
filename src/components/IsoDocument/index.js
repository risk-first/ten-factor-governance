import React, {useEffect} from 'react';
import Link from '@docusaurus/Link';
import DownloadYamlButton from '@site/src/components/DownloadYamlButton';
import RevealItem from '@site/src/components/RevealItem';
import styles from './styles.module.css';

/**
 * Wrap rendered YAML entities so their `id` field is an HTML anchor of the
 * same name. Duplicate ids within one document are invalid HTML; fix the YAML.
 */
function Anchored({id: yamlId, className, children, as: Tag = 'div'}) {
  return (
    <Tag
      id={typeof yamlId === 'string' && yamlId ? yamlId : undefined}
      className={className}
      data-yaml-id={typeof yamlId === 'string' && yamlId ? yamlId : undefined}
    >
      {children}
    </Tag>
  );
}

function scrollToLocationHash() {
  if (typeof window === 'undefined') {
    return;
  }
  const hash = window.location.hash?.replace(/^#/, '');
  if (!hash) {
    return;
  }
  const el = document.getElementById(hash);
  if (!el) {
    return;
  }
  const details = el.matches('details')
    ? el
    : el.querySelector('details') || el.closest('details');
  if (details) {
    details.open = true;
  }
  el.scrollIntoView({block: 'start'});
}

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
    Object.keys(value).every((k) =>
      ['reference-id', 'entry-id', 'version', 'url', 'title'].includes(k),
    )
  );
}

function isContact(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value.name || value.affiliation) &&
    !value['reference-id'] &&
    !value.id &&
    !value.title
  );
}

function contactText(contact) {
  if (!isContact(contact)) {
    return '';
  }
  return [contact.name, contact.affiliation].filter(Boolean).join(' — ');
}

function humanizeKey(key) {
  return String(key).replace(/-/g, ' ');
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

const ISO42001_GUIDANCE_CATALOG =
  '/docs/artifacts/iso-iec/iso42001/guidance-catalog';

const ISO42001_CLAUSE_ANCHOR_OVERRIDES = {
  '9.2': 'iso42001-9.2.1',
  '9.3': 'iso42001-9.3.1',
};

function iso42001GuidanceHref(clause) {
  if (typeof clause !== 'string' || !clause.trim()) {
    return null;
  }
  const key = clause.trim();
  const anchor = ISO42001_CLAUSE_ANCHOR_OVERRIDES[key] ?? `iso42001-${key}`;
  return `${ISO42001_GUIDANCE_CATALOG}#${anchor}`;
}

function ClauseBadge({clause, standard}) {
  const is42001 = typeof standard === 'string' && standard.includes('42001');
  const href = is42001 ? iso42001GuidanceHref(clause) : null;
  const badge = <code className={styles.clause}>{clause}</code>;
  if (!href) {
    return badge;
  }
  return (
    <Link
      to={href}
      className={styles.clauseLink}
      title={`ISO/IEC 42001 guidance: ${clause}`}
    >
      {badge}
    </Link>
  );
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
    <ul className={styles.flatList}>
      {refs.map((ref, index) => {
        const id = ref['reference-id'];
        if (!id) {
          return null;
        }
        const entryId = ref['entry-id'];
        return (
          <li
            key={`${id}-${entryId || index}`}
            id={entryId || undefined}
            className={styles.flatItem}
          >
            <MappingRefLink
              id={id}
              entryId={entryId}
              mappingById={mappingById}
            />
          </li>
        );
      })}
    </ul>
  );
}

function itemTitle(item, index) {
  return (
    textOf(item.title) ||
    textOf(item.name) ||
    textOf(item.id) ||
    textOf(item.outcome) ||
    textOf(item.subject) ||
    textOf(item.method) ||
    (item.party?.['entry-id'] ? String(item.party['entry-id']) : '') ||
    textOf(item.statement) ||
    textOf(item.description) ||
    `Item ${index + 1}`
  );
}

/** Named entities keep an accordion; thin objects (criteria, etc.) list flat. */
function hasEntityIdentity(item) {
  return Boolean(
    (typeof item?.id === 'string' && item.id) ||
      textOf(item?.title) ||
      textOf(item?.name),
  );
}

function FlatItemList({items, mappingById}) {
  return (
    <ul className={styles.flatList}>
      {items.map((item, index) => {
        const primaryKey = ['description', 'statement', 'summary'].find(
          (key) => typeof item?.[key] === 'string' && item[key].trim(),
        );
        const primary = primaryKey
          ? item[primaryKey].trim()
          : itemTitle(item, index);
        const bodyItem = primaryKey
          ? Object.fromEntries(
              Object.entries(item).filter(([key]) => key !== primaryKey),
            )
          : item;
        return (
          <Anchored
            key={item?.id || `flat-${index}`}
            id={item?.id}
            className={styles.flatItem}
            as="li"
          >
            <div className={styles.flatPrimary}>{primary}</div>
            <ItemBody
              item={bodyItem}
              mappingById={mappingById}
              omitBodyKeys={false}
            />
          </Anchored>
        );
      })}
    </ul>
  );
}

/** Keys used as the RevealItem title — still shown as fields when useful. */
const TITLE_KEYS = new Set(['id', 'title', 'name']);

/** Prefer these as the leading prose body when present. */
const BODY_KEYS = [
  'description',
  'narrative',
  'statement',
  'summary',
  'justification',
  'purpose',
  'action',
  'content',
  'influence',
];

function NestedObject({value, mappingById}) {
  return (
    <dl className={styles.nestedMeta}>
      {Object.entries(value).map(([key, child]) => {
        const rendered = renderValue(child, mappingById, key);
        if (rendered == null || rendered === '') {
          return null;
        }
        return (
          <div key={key} className={styles.metaRow}>
            <dt>{humanizeKey(key)}</dt>
            <dd>{rendered}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function renderValue(value, mappingById, label) {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (isReference(value)) {
    return (
      <MappingRefLink
        key={label}
        id={value['reference-id']}
        entryId={value['entry-id']}
        mappingById={mappingById}
      />
    );
  }
  if (isContact(value)) {
    return contactText(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }
    if (value.every(isReference)) {
      return (
        <span className={styles.refTargets}>
          {value.map((ref, index) => (
            <React.Fragment key={`${label}-${ref['reference-id']}-${index}`}>
              {index > 0 ? ', ' : null}
              <MappingRefLink
                id={ref['reference-id']}
                entryId={ref['entry-id']}
                mappingById={mappingById}
              />
            </React.Fragment>
          ))}
        </span>
      );
    }
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <ul className={styles.bulletList}>
          {value.map((entry, index) => (
            <li key={`${label}-${index}`}>{String(entry)}</li>
          ))}
        </ul>
      );
    }
    // Array of structured objects (metrics, allocations, actions, …)
    return (
      <div className={styles.nestedList}>
        {value.map((entry, index) => (
          <Anchored
            key={entry?.id || `${label}-${index}`}
            id={entry?.id}
            className={styles.nestedCard}
          >
            <div className={styles.nestedCardTitle}>
              {itemTitle(entry, index)}
            </div>
            <ItemBody item={entry} mappingById={mappingById} omitBodyKeys={false} />
          </Anchored>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    const nested = <NestedObject value={value} mappingById={mappingById} />;
    if (typeof value.id === 'string' && value.id) {
      return <Anchored id={value.id}>{nested}</Anchored>;
    }
    return nested;
  }
  return String(value);
}

function ItemBody({item, mappingById, omitBodyKeys = true}) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  let bodyKey = null;
  let bodyText = '';
  for (const key of BODY_KEYS) {
    if (typeof item[key] === 'string' && item[key].trim()) {
      bodyKey = key;
      bodyText = item[key].trim();
      break;
    }
  }
  // root-cause.statement special case for corrective actions
  if (!bodyText && item['root-cause']?.statement) {
    bodyKey = 'root-cause';
    bodyText = textOf(item['root-cause'].statement);
  }

  const extras = [];
  for (const [key, value] of Object.entries(item)) {
    if (TITLE_KEYS.has(key)) {
      continue;
    }
    if (omitBodyKeys && key === bodyKey && key !== 'root-cause') {
      continue;
    }
    if (key === 'root-cause' && bodyKey === 'root-cause') {
      // still render nested fields other than statement via NestedObject below
      const rest = {...item['root-cause']};
      delete rest.statement;
      if (Object.keys(rest).length === 0) {
        continue;
      }
      const rendered = renderValue(rest, mappingById, key);
      if (rendered != null && rendered !== '') {
        extras.push([humanizeKey(key), rendered]);
      }
      continue;
    }
    const rendered = renderValue(value, mappingById, key);
    if (rendered == null || rendered === '') {
      continue;
    }
    extras.push([humanizeKey(key), rendered]);
  }

  return (
    <>
      {bodyText ? <p className={styles.bodyText}>{bodyText}</p> : null}
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

function CollectionSection({title, items, mappingById, id}) {
  const named = items.filter(hasEntityIdentity);
  const useAccordion = named.length === items.length && items.length > 0;

  return (
    <section className={styles.group} id={id}>
      <h2 className={styles.groupTitle}>
        {title}
        <span className={styles.count}> ({items.length})</span>
      </h2>
      {useAccordion ? (
        <div className={styles.itemList}>
          {items.map((item, index) => (
            <Anchored key={item?.id || `${id}-${index}`} id={item?.id}>
              <RevealItem
                title={
                  <>
                    {item?.id ? (
                      <span className={styles.itemId}>{item.id}</span>
                    ) : null}
                    {itemTitle(item, index)}
                  </>
                }
              >
                <ItemBody item={item} mappingById={mappingById} />
              </RevealItem>
            </Anchored>
          ))}
        </div>
      ) : (
        <FlatItemList items={items} mappingById={mappingById} />
      )}
    </section>
  );
}

function ObjectSection({title, object, mappingById, id}) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return null;
  }
  const named = hasEntityIdentity(object);
  return (
    <section className={styles.group} id={id}>
      <h2 className={styles.groupTitle}>{title}</h2>
      {named ? (
        <div className={styles.itemList}>
          <Anchored id={object.id}>
            <RevealItem title={itemTitle(object, 0)}>
              <ItemBody item={object} mappingById={mappingById} />
            </RevealItem>
          </Anchored>
        </div>
      ) : (
        <div className={styles.flatItem}>
          <Anchored id={object.id}>
            <ItemBody
              item={object}
              mappingById={mappingById}
              omitBodyKeys={false}
            />
          </Anchored>
        </div>
      )}
    </section>
  );
}

function ScalarSection({title, value, id}) {
  const text = textOf(value);
  if (!text) {
    return null;
  }
  return (
    <section className={styles.group} id={id}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <p className={styles.bodyText}>{text}</p>
    </section>
  );
}

function ApprovalBanner({approval}) {
  if (!approval || typeof approval !== 'object') {
    return null;
  }
  const who = contactText(approval['approved-by']);
  const bits = [
    who ? `Approved by ${who}` : null,
    approval.date ? `on ${approval.date}` : null,
    approval['effective-date']
      ? `effective ${approval['effective-date']}`
      : null,
  ].filter(Boolean);
  if (bits.length === 0) {
    return null;
  }
  return <p className={styles.approval}>{bits.join(' · ')}</p>;
}

/** Top-level keys handled specially or skipped (not generic sections). */
const SKIP_TOP_KEYS = new Set(['title', 'metadata', 'clauses']);

/**
 * Front-matter callout: scope statement if present, else metadata description.
 * Document-level `purpose` is always its own section when present and distinct.
 */
function FrontMatter({file, metadata}) {
  const primary = textOf(file.statement) || textOf(metadata.description);
  const purpose = textOf(file.purpose);
  const showPurpose =
    Boolean(purpose) && purpose !== primary;

  if (!primary && !showPurpose) {
    return null;
  }

  return (
    <>
      {primary ? <div className={styles.frontMatter}>{primary}</div> : null}
      {showPurpose ? (
        <section className={styles.group} id="group-purpose">
          <h2 className={styles.groupTitle}>Purpose</h2>
          <p className={styles.bodyText}>{purpose}</p>
        </section>
      ) : null}
    </>
  );
}

function skippedBecauseFrontMatter(file, metadata, key) {
  if (key === 'statement' && textOf(file.statement)) {
    return true;
  }
  if (key === 'purpose' && textOf(file.purpose)) {
    return true;
  }
  return false;
}

function TopLevelSection({sectionKey, value, mappingById}) {
  const title = humanizeKey(sectionKey);
  const id = `group-${sectionKey}`;

  if (value == null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <ScalarSection title={title} value={value} id={id} />;
  }

  if (isReference(value)) {
    return (
      <section className={styles.group} id={id}>
        <h2 className={styles.groupTitle}>{title}</h2>
        <p>
          <MappingRefLink
            id={value['reference-id']}
            entryId={value['entry-id']}
            mappingById={mappingById}
          />
        </p>
      </section>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }
    if (value.every(isReference)) {
      return (
        <section className={styles.group} id={id}>
          <h2 className={styles.groupTitle}>
            {title}
            <span className={styles.count}> ({value.length})</span>
          </h2>
          <ReferenceList refs={value} mappingById={mappingById} />
        </section>
      );
    }
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <section className={styles.group} id={id}>
          <h2 className={styles.groupTitle}>{title}</h2>
          <ul className={styles.bulletList}>
            {value.map((entry, index) => (
              <li key={`${sectionKey}-${index}`}>{String(entry)}</li>
            ))}
          </ul>
        </section>
      );
    }
    return (
      <CollectionSection
        title={title}
        items={value}
        mappingById={mappingById}
        id={id}
      />
    );
  }

  if (typeof value === 'object') {
    return (
      <ObjectSection
        title={title}
        object={value}
        mappingById={mappingById}
        id={id}
      />
    );
  }

  return null;
}

/**
 * Renderer for ISO management-system documents that are not Gemara catalogs.
 * Walks every top-level YAML field (except title/metadata/clauses handled
 * above) so document content is not silently dropped. Every YAML `id` is
 * exposed as an HTML element id of the same name (first occurrence wins if
 * duplicated within the document).
 */
export default function IsoDocument({file}) {
  useEffect(() => {
    const run = () => {
      // Defer until after RevealItems / nested anchors mount.
      requestAnimationFrame(() => scrollToLocationHash());
    };
    run();
    window.addEventListener('hashchange', run);
    return () => window.removeEventListener('hashchange', run);
  }, [file]);

  if (!file) {
    return (
      <p className={styles.empty}>
        <code>IsoDocument</code> requires a <code>file</code> prop.
      </p>
    );
  }

  const metadata = file.metadata ?? {};
  const mappingById = indexMappingReferences(metadata);
  const isAimsProfile =
    metadata.type === 'AIMS' || (!metadata.type && file.scope && file.policy);

  const topEntries = Object.entries(file).filter(
    ([key]) =>
      !SKIP_TOP_KEYS.has(key) &&
      !skippedBecauseFrontMatter(file, metadata, key),
  );

  return (
    <div className={styles.doc} id={metadata.id || undefined}>
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
            <span className={`${styles.badge} ${styles.badgeMuted}`}>
              draft
            </span>
          ) : null}
        </div>
        <DownloadYamlButton file={file} />
      </div>

      <FrontMatter file={file} metadata={metadata} />
      <ApprovalBanner approval={metadata.approval} />

      {Array.isArray(file.clauses) && file.clauses.length > 0 ? (
        <p className={styles.clauses}>
          Clauses:{' '}
          {file.clauses.map((c) => (
            <ClauseBadge key={c} clause={c} standard={metadata.standard} />
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
                if (refs.length === 0 || !refs.every(isReference)) {
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
      ) : (
        topEntries.map(([key, value]) => (
          <TopLevelSection
            key={key}
            sectionKey={key}
            value={value}
            mappingById={mappingById}
          />
        ))
      )}
    </div>
  );
}
