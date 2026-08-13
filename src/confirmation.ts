/**
 * Holds a proposed amplitude change in a pending state so it can be rendered
 * for review alongside the value it would replace. Nothing is transmitted to
 * the implant while a change is pending; the pending change is discarded if
 * the clinician dismisses the review.
 *
 * @itemId:fn-stage-amplitude-change
 * @itemTitle:"Stage a pending amplitude change for review"
 * @itemType:Software Item Spec
 * @itemFulfills:NC-7
 */
export function stageAmplitudeChange(
  committedMa: number,
  requestedMa: number,
): PendingAmplitudeChange {
  return {
    priorMa: committedMa,
    proposedMa: requestedMa,
    confirmed: false,
  };
}

/**
 * Requires an explicit confirmation action from the authenticated clinician
 * before a pending amplitude change is released for transmission. An
 * unconfirmed or dismissed change never reaches the implant, and the identity
 * of the confirming clinician is carried forward with the committed value.
 *
 * @itemId:fn-confirm-amplitude-change
 * @itemTitle:"Confirm a pending amplitude change before delivery"
 * @itemType:Software Item Spec
 * @itemFulfills:NC-7
 */
export function confirmAmplitudeChange(
  pending: PendingAmplitudeChange | null,
  clinicianId: string,
): AmplitudeCommitResult {
  if (!pending) {
    return { transmitted: false, reason: 'NO_PENDING_CHANGE' };
  }
  if (!clinicianId) {
    return { transmitted: false, reason: 'NOT_AUTHENTICATED' };
  }
  return {
    transmitted: true,
    amplitudeMa: pending.proposedMa,
    priorMa: pending.priorMa,
    confirmedBy: clinicianId,
  };
}

export interface PendingAmplitudeChange {
  priorMa: number;
  proposedMa: number;
  confirmed: boolean;
}

export type AmplitudeCommitResult =
  | { transmitted: false; reason: string }
  | {
      transmitted: true;
      amplitudeMa: number;
      priorMa: number;
      confirmedBy: string;
    };
