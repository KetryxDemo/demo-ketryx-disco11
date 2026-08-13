'use strict';

// Minimal model of the clinician programmer, sufficient to exercise the
// behaviors described in specs/. Not device software.

const STEP_LIMIT_MA = 0.5;
const IDLE_TIMEOUT_MINUTES = 15;
const ABORT_BUDGET_MS = 2000;

// Therapeutic impedance window for a stimulation lead. Outside it the charge
// actually delivered no longer corresponds to the programmed amplitude.
const IMPEDANCE_MIN_OHMS = 200;
const IMPEDANCE_MAX_OHMS = 2000;

class Programmer {
  constructor() {
    this.authenticated = false;
    this.patientMatchConfirmed = false;
    this.telemetryOpen = false;
    this.sessionOpen = false;
    this.requiresReauth = false;
    this.pending = null;
    this.lastTransmitted = null;
    this.committed = { amplitudeMa: 0 };
    this.lastCommittedAmplitude = 0;
    this.ceilingMa = 4.0;
    this.clinician = null;
    this.auditLog = [];
    this.leadImpedanceOhms = 800;
  }

  reportLeadImpedance(ohms) {
    this.leadImpedanceOhms = ohms;
    return { measuredOhms: ohms };
  }

  screenLeadImpedance() {
    const ohms = this.leadImpedanceOhms;
    if (!Number.isFinite(ohms)) {
      return { withinWindow: false, reason: 'IMPEDANCE_UNAVAILABLE' };
    }
    if (ohms < IMPEDANCE_MIN_OHMS) {
      return { withinWindow: false, reason: 'IMPEDANCE_BELOW_WINDOW', measuredOhms: ohms };
    }
    if (ohms > IMPEDANCE_MAX_OHMS) {
      return { withinWindow: false, reason: 'IMPEDANCE_ABOVE_WINDOW', measuredOhms: ohms };
    }
    return { withinWindow: true, measuredOhms: ohms };
  }

  static inOpenSession({ amplitudeMa = 2.0, ceilingMa = 4.0, clinician = 'dr-lin' } = {}) {
    const p = new Programmer();
    p.authenticate({ role: 'Programmer', id: clinician });
    p.confirmPatientMatch();
    p.openSession();
    p.ceilingMa = ceilingMa;
    p.committed.amplitudeMa = amplitudeMa;
    p.lastCommittedAmplitude = amplitudeMa;
    return p;
  }

  authenticate({ role, id = 'dr-lin' }) {
    this.authenticated = role === 'Programmer';
    this.clinician = this.authenticated ? id : null;
    return this.authenticated;
  }

  confirmPatientMatch() {
    this.patientMatchConfirmed = true;
  }

  openSession() {
    if (!this.authenticated) {
      return { opened: false, reason: 'NOT_AUTHENTICATED' };
    }
    if (!this.patientMatchConfirmed) {
      return { opened: false, reason: 'PATIENT_MATCH_UNCONFIRMED' };
    }
    this.sessionOpen = true;
    this.telemetryOpen = true;
    return { opened: true };
  }

  advanceIdleMinutes(minutes) {
    if (minutes >= IDLE_TIMEOUT_MINUTES) {
      this.sessionOpen = false;
      this.telemetryOpen = false;
      this.requiresReauth = true;
      this.authenticated = false;
    }
    return { sessionOpen: this.sessionOpen };
  }

  propose({ amplitudeMa }) {
    this.pending = { amplitudeMa };
    return this.pending;
  }

  abandonPending() {
    this.pending = null;
    return { discarded: true };
  }

  requestAmplitude(mA) {
    // A lead outside the therapeutic impedance window cannot deliver the
    // programmed charge, so no adjustment is accepted against it.
    const impedance = this.screenLeadImpedance();
    if (!impedance.withinWindow) {
      return { accepted: false, reason: impedance.reason };
    }
    // The implant ceiling applies regardless of step size, so it is checked first.
    if (mA > this.ceilingMa) {
      return { accepted: false, reason: 'CEILING_EXCEEDED' };
    }
    const step = Math.abs(mA - this.committed.amplitudeMa);
    if (step > STEP_LIMIT_MA) {
      return { accepted: false, reason: 'STEP_LIMIT_EXCEEDED' };
    }
    this.pending = { amplitudeMa: mA };
    return { accepted: true };
  }

  loseTelemetry() {
    const aborted = this.pending !== null;
    this.pending = null;
    this.telemetryOpen = false;
    return { aborted, abortLatencyMs: 350 <= ABORT_BUDGET_MS ? 350 : ABORT_BUDGET_MS };
  }

  setAmplitude(mA) {
    this.committed.amplitudeMa = mA;
    this.lastCommittedAmplitude = mA;
  }

  performHandshake({ peerCertTrusted }) {
    if (!peerCertTrusted) {
      this.telemetryOpen = false;
      return { established: false, reason: 'PEER_CERT_UNTRUSTED' };
    }
    this.telemetryOpen = true;
    return { established: true };
  }

  deriveSessionKey(sessionIndex) {
    // Per-session derivation: keys are never reused across sessions.
    return `sk-${this.clinician || 'anon'}-${sessionIndex}-${sessionIndex * 7919 + 13}`;
  }

  commitAmplitude(mA) {
    const prior = this.committed.amplitudeMa;
    this.committed.amplitudeMa = mA;
    this.lastCommittedAmplitude = mA;
    this.lastTransmitted = mA;
    this.auditLog.push({
      parameter: 'amplitudeMa',
      priorValue: prior,
      newValue: mA,
      timestamp: new Date().toISOString(),
      clinician: this.clinician,
    });
    return { committed: true };
  }
}

module.exports = { Programmer, STEP_LIMIT_MA, IDLE_TIMEOUT_MINUTES };
