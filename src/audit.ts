/**
 * Resolves the identity that will be stamped on an audit entry from the active
 * session. An entry is never written under an anonymous or expired session:
 * if the session cannot produce an authenticated clinician, the caller is
 * refused rather than defaulting to an unattributed identity.
 *
 * @itemId:fn-resolve-clinician-identity
 * @itemTitle:"Resolve the clinician identity stamped on an audit entry"
 * @itemType:Software Item Spec
 * @itemFulfills:NC-11
 */
export function resolveClinicianIdentity(
  session: ProgrammerSession,
): string | null {
  if (!session.authenticated || session.requiresReauth) {
    return null;
  }
  return session.clinicianId ?? null;
}

/**
 * Appends one append-only record per committed parameter change, capturing the
 * parameter, its prior value, its new value, the commit timestamp, and the
 * identity of the clinician who confirmed it. Entries are never rewritten or
 * removed for the life of the session, so the sequence of changes can be
 * reconstructed after the fact.
 *
 * @itemId:fn-append-audit-entry
 * @itemTitle:"Append a parameter change to the audit log"
 * @itemType:Software Item Spec
 * @itemFulfills:NC-11
 */
export function appendAuditEntry(
  log: AuditEntry[],
  change: ParameterChange,
  clinicianId: string | null,
): AuditAppendResult {
  if (!clinicianId) {
    return { appended: false, reason: 'UNATTRIBUTED_CHANGE' };
  }
  const entry: AuditEntry = {
    parameter: change.parameter,
    priorValue: change.priorValue,
    newValue: change.newValue,
    committedAt: change.committedAt,
    clinicianId,
  };
  log.push(entry);
  return { appended: true, entry };
}

export interface ProgrammerSession {
  authenticated: boolean;
  requiresReauth: boolean;
  clinicianId?: string | null;
}

export interface ParameterChange {
  parameter: string;
  priorValue: number;
  newValue: number;
  committedAt: string;
}

export interface AuditEntry extends ParameterChange {
  clinicianId: string;
}

export type AuditAppendResult =
  | { appended: false; reason: string }
  | { appended: true; entry: AuditEntry };
