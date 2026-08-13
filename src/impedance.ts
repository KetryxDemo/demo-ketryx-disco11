/**
 * Screens a stimulation lead's measured impedance against the therapeutic
 * window before a proposed parameter change is released to the implant.
 * Impedance below the window indicates a short between contacts and impedance
 * above it indicates an open or fractured conductor; in either case the charge
 * actually delivered no longer corresponds to the programmed amplitude, so the
 * change must not be transmitted.
 *
 * @itemId:fn-screen-lead-impedance
 * @itemTitle:"Screen lead impedance before a parameter change"
 * @itemType:Software Item Spec
 */
export function screenLeadImpedance(
  measuredOhms: number,
  window: ImpedanceWindow = DEFAULT_IMPEDANCE_WINDOW,
): ImpedanceScreenResult {
  if (!Number.isFinite(measuredOhms)) {
    return { withinWindow: false, reason: 'IMPEDANCE_UNAVAILABLE' };
  }
  if (measuredOhms < window.minOhms) {
    return { withinWindow: false, reason: 'IMPEDANCE_BELOW_WINDOW', measuredOhms };
  }
  if (measuredOhms > window.maxOhms) {
    return { withinWindow: false, reason: 'IMPEDANCE_ABOVE_WINDOW', measuredOhms };
  }
  return { withinWindow: true, measuredOhms };
}

export const DEFAULT_IMPEDANCE_WINDOW: ImpedanceWindow = {
  minOhms: 200,
  maxOhms: 2000,
};

export interface ImpedanceWindow {
  minOhms: number;
  maxOhms: number;
}

export type ImpedanceScreenResult =
  | { withinWindow: true; measuredOhms: number }
  | { withinWindow: false; reason: string; measuredOhms?: number };
