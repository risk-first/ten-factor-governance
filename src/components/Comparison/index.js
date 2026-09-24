import React, {Children, isValidElement} from 'react';
import styles from './styles.module.css';

function createSlot(displayName) {
  function Slot({children}) {
    return children;
  }
  Slot.displayName = displayName;
  return Slot;
}

export const Requirement = createSlot('Requirement');
export const AddressedBy = createSlot('AddressedBy');
export const Gap = createSlot('Gap');
export const Recommendation = createSlot('Recommendation');

const SLOTS = [Requirement, AddressedBy, Gap, Recommendation];

function getSlot(children, Slot) {
  const match = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === Slot,
  );
  return match?.props?.children ?? null;
}

/** Everything that is not a recognised slot: trailing commentary on the assessment. */
function getBody(children) {
  const rest = Children.toArray(children).filter((child) => {
    if (isValidElement(child)) {
      return !SLOTS.includes(child.type);
    }
    return String(child).trim() !== '';
  });
  return rest.length > 0 ? rest : null;
}

/**
 * Maps a free-text coverage label onto one of four colour bands. The label
 * itself is displayed verbatim, so compound values such as `Conceptual–Partial`
 * or `Partial–strong / closest alignment` keep their nuance while still
 * colouring by their leading term.
 */
function coverageBand(result) {
  const value = String(result ?? '').trim().toLowerCase();
  if (value.startsWith('full')) {
    return styles.resultFull;
  }
  if (value.startsWith('partial')) {
    return styles.resultPartial;
  }
  if (value.startsWith('conceptual')) {
    return styles.resultConceptual;
  }
  if (value.startsWith('does not cover') || value.startsWith('not represented')) {
    return styles.resultNone;
  }
  return '';
}

function slugify(item, title) {
  return [item, title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * One requirement-by-requirement comparison of a standard against Ten Factor
 * Governance. `AddressedBy` lists the relevant factors; any prose left outside
 * the slots is rendered after that list as trailing commentary.
 *
 * ```mdx
 * <Comparison result="Partial" item="7.2" title="Competence">
 *
 * <Requirement>Determine required competence and retain evidence.</Requirement>
 *
 * <AddressedBy>
 *
 * - [Governance Has Owners](/docs/factors/governance-has-owners) only indirectly
 *
 * </AddressedBy>
 *
 * <Gap>No personnel lifecycle.</Gap>
 *
 * <Recommendation>Keep as an HR profile.</Recommendation>
 *
 * </Comparison>
 * ```
 *
 * @param {object} props
 * @param {string} props.result - Coverage label, e.g. `Full`, `Conceptual–Partial`
 * @param {string} [props.item] - Clause or control reference, e.g. `A.8.25`
 * @param {string} props.title - Short name of the requirement
 * @param {string} [props.id] - Override the generated anchor id
 * @param {React.ReactNode} props.children
 */
export default function Comparison({result, item, title, id, children}) {
  const requirement = getSlot(children, Requirement);
  const addressedBy = getSlot(children, AddressedBy);
  const gap = getSlot(children, Gap);
  const recommendation = getSlot(children, Recommendation);
  const body = getBody(children);
  const anchor = id ?? slugify(item, title);

  return (
    <section className={styles.comparison} id={anchor}>
      <header className={styles.header}>
        <h3 className={styles.heading}>
          <a className={styles.anchor} href={`#${anchor}`}>
            {item ? <span className={styles.item}>{item}</span> : null}
            <span className={styles.title}>{title}</span>
          </a>
        </h3>
        {result ? (
          <span className={`${styles.result} ${coverageBand(result)}`}>
            {result}
          </span>
        ) : null}
      </header>

      {requirement ? (
        <div className={styles.requirement}>{requirement}</div>
      ) : null}

      {addressedBy ? (
        <div className={styles.addressedBy}>
          <span className={styles.label}>Addressed by</span>
          <div className={styles.factorList}>{addressedBy}</div>
        </div>
      ) : null}

      {body ? <div className={styles.assessment}>{body}</div> : null}

      {gap ? (
        <div className={styles.gap}>
          <span className={styles.label}>Gap</span>
          <div className={styles.slotBody}>{gap}</div>
        </div>
      ) : null}

      {recommendation ? (
        <div className={styles.recommendation}>
          <span className={styles.label}>Recommended action</span>
          <div className={styles.slotBody}>{recommendation}</div>
        </div>
      ) : null}
    </section>
  );
}
