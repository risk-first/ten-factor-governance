import React, {Children, isValidElement} from 'react';
import {
  AntiPatterns,
  References,
  RelatedFactors,
} from '@site/src/components/GovernanceFactor';
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
export const GemaraStructure = createSlot('GemaraStructure');

// Shared with GovernanceFactor so MDX can register one set of slots.
export {AntiPatterns, References, RelatedFactors};

const SLOTS = {
  Purpose,
  Role,
  Examples,
  LinksUpstream,
  LinksDownstream,
  GemaraStructure,
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

function layerKey(layer) {
  if (layer === 'cross' || layer === 'Cross') {
    return 'cross';
  }
  if (layer == null || layer === '') {
    return null;
  }
  return String(layer);
}

function layerLabel(layer) {
  const key = layerKey(layer);
  if (key === 'cross') {
    return 'Cross-cutting';
  }
  if (!key) {
    return null;
  }
  return `Gemara Layer ${key}`;
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

/**
 * Structured template for a Gemara governance artifact type.
 *
 * Canonical sections: Purpose, Role, Examples, Links Upstream,
 * Links Downstream, Anti-Patterns, Related Factors, Gemara Structure, References.
 */
export default function GovernanceArtifact({
  title,
  gemaraType,
  layer,
  gemaraUrl,
  children,
}) {
  const purpose = getSlot(children, SLOTS.Purpose);
  const role = getSlot(children, SLOTS.Role);
  const examples = getSlot(children, SLOTS.Examples);
  const linksUpstream = getSlot(children, SLOTS.LinksUpstream);
  const linksDownstream = getSlot(children, SLOTS.LinksDownstream);
  const gemaraStructure = getSlot(children, SLOTS.GemaraStructure);
  const antiPatterns = getSlot(children, SLOTS.AntiPatterns);
  const relatedFactors = getSlot(children, SLOTS.RelatedFactors);
  const references = getSlot(children, SLOTS.References);

  const key = layerKey(layer);
  const layerText = layerLabel(layer);
  const layerClass = key ? styles[`layer${key === 'cross' ? 'Cross' : key}`] : '';
  const docsUrl =
    gemaraUrl || (gemaraType ? GEMARA_DOCS[gemaraType] : null) || null;

  return (
    <article
      className={`${styles.artifact}${layerClass ? ` ${layerClass}` : ''}`}
      data-layer={key || undefined}
    >
      <header className={styles.header}>
        <div className={styles.badges}>
          <p className={styles.eyebrow}>Governance artifact</p>
          {layerText ? (
            docsUrl ? (
              <a
                className={styles.layerBadge}
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${gemaraType || title} on Gemara`}
              >
                {layerText}
              </a>
            ) : (
              <p className={styles.layerBadge}>{layerText}</p>
            )
          ) : null}
          {gemaraType ? (
            <p className={styles.typeBadge}>
              <code>{gemaraType}</code>
            </p>
          ) : null}
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
        id="gemara-structure"
        title="Gemara structure"
        variant="accent"
        bodyClassName={`${styles.prose} ${styles.diagramContent}`}
      >
        {gemaraStructure}
      </Section>

      <Section id="references" title="References" bodyClassName={styles.listContent}>
        {references}
      </Section>
    </article>
  );
}
