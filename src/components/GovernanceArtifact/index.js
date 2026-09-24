import React, {Children, isValidElement} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {
  AntiPatterns,
  References,
  RelatedFactors,
} from '@site/src/components/GovernanceFactor';
import BandPill from '@site/src/components/BandPill';
import {bandFromTags} from '@site/src/data/bands';
import styles from './styles.module.css';

function Section({id, title, children, bodyClassName, variant}) {
  if (children == null || children === false || children === '') {
    return null;
  }
  if (Array.isArray(children) && children.length === 0) {
    return null;
  }
  const variantClass =
    variant === 'warn'
      ? styles.sectionWarn
      : variant === 'accent'
        ? styles.sectionAccent
        : '';
  return (
    <section
      className={`${styles.section}${variantClass ? ` ${variantClass}` : ''}`}
      id={id}
    >
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div
        className={`${styles.sectionBody}${bodyClassName ? ` ${bodyClassName}` : ''}`}
      >
        {children}
      </div>
    </section>
  );
}

function createSlot(displayName) {
  function Slot({children}) {
    return children;
  }
  Slot.displayName = displayName;
  return Slot;
}

export const Purpose = createSlot('Purpose');
export const Role = createSlot('Role');
export const Examples = createSlot('Examples');
export const LinksUpstream = createSlot('LinksUpstream');
export const LinksDownstream = createSlot('LinksDownstream');
export const EntityRelationshipDiagram = createSlot('EntityRelationshipDiagram');

// Shared with GovernanceFactor so MDX can register one set of slots.
export {AntiPatterns, References, RelatedFactors};

const SLOTS = {
  Purpose,
  Role,
  Examples,
  LinksUpstream,
  LinksDownstream,
  EntityRelationshipDiagram,
  AntiPatterns,
  RelatedFactors,
  References,
};

function getSlotElement(children, Slot) {
  return (
    Children.toArray(children).find(
      (child) => isValidElement(child) && child.type === Slot,
    ) ?? null
  );
}

function getSlot(children, Slot) {
  return getSlotElement(children, Slot)?.props?.children ?? null;
}

const CATALOG_LABELS = {
  gemara: 'Gemara',
  iso27001: 'ISO 27001',
  iso42001: 'ISO 42001',
};

function catalogLabel(key) {
  return CATALOG_LABELS[key] ?? key;
}

/** Gemara docs that describe each top-level artifact type. */
const GEMARA_DOCS = {
  PrincipleCatalog: 'https://gemara.openssf.org/schema/principlecatalog.html',
  VectorCatalog: 'https://gemara.openssf.org/schema/vectorcatalog.html',
  GuidanceCatalog: 'https://gemara.openssf.org/schema/guidancecatalog.html',
  CapabilityCatalog: 'https://gemara.openssf.org/schema/capabilitycatalog.html',
  ThreatCatalog: 'https://gemara.openssf.org/schema/threatcatalog.html',
  ControlCatalog: 'https://gemara.openssf.org/schema/controlcatalog.html',
  RiskCatalog: 'https://gemara.openssf.org/schema/riskcatalog.html',
  Policy: 'https://gemara.openssf.org/schema/policy.html',
  SensitiveActivity:
    'https://gemara.openssf.org/model/06-sensitive-activities.html',
  EvaluationLog: 'https://gemara.openssf.org/schema/evaluationlog.html',
  EnforcementLog: 'https://gemara.openssf.org/schema/enforcementlog.html',
  AuditLog: 'https://gemara.openssf.org/schema/auditlog.html',
  Lexicon: 'https://gemara.openssf.org/schema/lexicon.html',
  MappingDocument: 'https://gemara.openssf.org/schema/mappingdocument.html',
  RACI: 'https://gemara.openssf.org/schema/base.html',
};

function useDocFrontMatter() {
  try {
    return useDoc()?.frontMatter ?? {};
  } catch {
    return {};
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function akaFromFrontMatter(frontMatter) {
  const aka = frontMatter?.aka;
  if (!aka || typeof aka !== 'object' || Array.isArray(aka)) {
    return {};
  }
  return aka;
}

function listNames(...values) {
  const names = [];
  const seen = new Set();
  const push = (value) => {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    const name = firstString(value);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  };
  values.forEach(push);
  return names;
}

function StandardAlias({standard, name, href}) {
  if (!name) {
    return null;
  }
  const inner = (
    <>
      <span className={styles.aliasKey}>{standard}</span>
      {href ? <code>{name}</code> : <span className={styles.aliasValue}>{name}</span>}
    </>
  );
  if (href) {
    return (
      <a
        className={styles.typeBadge}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${name} on Gemara`}
      >
        {inner}
      </a>
    );
  }
  return <p className={styles.typeBadge}>{inner}</p>;
}

/**
 * Structured template for a governance artifact type.
 *
 * Canonical sections: Purpose, Role, Examples, Links Upstream,
 * Links Downstream, Anti-Patterns, Related Factors, Entity Relationship Diagram,
 * References.
 *
 * Identity comes from front matter: `title`, plus the names this artifact goes
 * by in each catalog under `aka` (`gemara`, `iso27001`, `iso42001`; each value
 * may be a string or a list of names). No catalog outranks another, so they
 * render in the order they are written. The lifecycle band named by the doc's
 * tags leads the header and sets the accent colour.
 */
export default function GovernanceArtifact({children}) {
  const frontMatter = useDocFrontMatter();
  const purpose = getSlot(children, SLOTS.Purpose);
  const role = getSlot(children, SLOTS.Role);
  const examples = getSlot(children, SLOTS.Examples);
  const linksUpstream = getSlot(children, SLOTS.LinksUpstream);
  const linksDownstream = getSlot(children, SLOTS.LinksDownstream);
  const entityRelationshipDiagram = getSlot(children, SLOTS.EntityRelationshipDiagram);
  const antiPatterns = getSlot(children, SLOTS.AntiPatterns);
  const relatedFactors = getSlot(children, SLOTS.RelatedFactors);
  const references = getSlot(children, SLOTS.References);

  const title = firstString(frontMatter.title);
  const aliases = Object.entries(akaFromFrontMatter(frontMatter)).flatMap(
    ([catalog, value]) =>
      listNames(value).map((name) => ({
        catalog,
        name,
        href: catalog === 'gemara' ? GEMARA_DOCS[name] : null,
      })),
  );

  const band = bandFromTags(frontMatter.tags);

  return (
    <article className={styles.artifact} data-band={band?.key}>
      <header className={styles.header}>
        <div className={styles.badges}>
          {band ? <BandPill band={band.key} /> : null}
          {aliases.map(({catalog, name, href}) => (
            <StandardAlias
              key={`${catalog}-${name}`}
              standard={catalogLabel(catalog)}
              name={name}
              href={href}
            />
          ))}
        </div>
        <h1 className={styles.title}>{title}</h1>
        {purpose && (
          <div className={styles.purpose}>
            <span className={styles.purposeLabel}>Purpose</span>
            {purpose}
          </div>
        )}
      </header>

      <Section id="role" title="Role" variant="accent" bodyClassName={styles.prose}>
        {role}
      </Section>

      <Section
        id="examples"
        title="Examples"
        variant="accent"
        bodyClassName={`${styles.listContent} ${styles.revealList}`}
      >
        {examples}
      </Section>

      <Section
        id="links-upstream"
        title="Links upstream"
        bodyClassName={styles.listContent}
      >
        {linksUpstream}
      </Section>

      <Section
        id="links-downstream"
        title="Links downstream"
        bodyClassName={styles.listContent}
      >
        {linksDownstream}
      </Section>

      <Section
        id="anti-patterns"
        title="Anti-patterns"
        variant="warn"
        bodyClassName={`${styles.listContent} ${styles.revealList}`}
      >
        {antiPatterns}
      </Section>

      <Section
        id="related-factors"
        title="Related factors"
        bodyClassName={styles.listContent}
      >
        {relatedFactors}
      </Section>

      <Section
        id="entity-relationship-diagram"
        title="Entity Relationship Diagram"
        variant="accent"
        bodyClassName={`${styles.prose} ${styles.diagramContent}`}
      >
        {entityRelationshipDiagram}
      </Section>

      <Section id="references" title="References" bodyClassName={styles.listContent}>
        {references}
      </Section>
    </article>
  );
}
