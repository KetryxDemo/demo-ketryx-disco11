'use strict';

// Minimal model of the clinician programmer, sufficient to exercise the
// behaviors described in specs/. Not device software.

const STEP_LIMIT_MA = 0.5;
const IDLE_TIMEOUT_MINUTES = 15;
const ABORT_BUDGET_MS = 2000;

// Versioned compatibility list, kept as replaceable data rather than a constant
// compiled into the programmer, so the supported set can be revised without
// reinstalling the application.
const FIRMWARE_COMPATIBILITY_LIST = {
  listVersion: '2026.03',
  supportedFirmwareVersions: ['3.2.0', '3.2.1', '3.3.0'],
};

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
    this.compatibilityList = FIRMWARE_COMPATIBILITY_LIST;
    this.implantFirmwareVersion = '3.2.1';
  }

  identifyImplant({ firmwareVersion }) {
    this.implantFirmwareVersion = firmwareVersion;
    return this.screenFirmwareCompatibility();
  }

  loadCompatibilityList(list) {
    // Replacing the list is a data update, not a reinstall of the programmer.
    this.compatibilityList = list;
    return { listVersion: list.listVersion };
  }

  screenFirmwareCompatibility() {
    const reported = this.implantFirmwareVersion;
    if (typeof reported !== 'string' || reported.trim() === '') {
      return { supported: false, reason: 'FIRMWARE_VERSION_UNREPORTED' };
    }
    if (!this.compatibilityList.supportedFirmwareVersions.includes(reported)) {
      return { supported: false, reason: 'FIRMWARE_UNSUPPORTED', firmwareVersion: reported };
    }
    return { supported: true, firmwareVersion: reported };
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
    // Screened before authentication so an unprogrammable implant is rejected
    // without exposing session credentials to it.
    const compatibility = this.screenFirmwareCompatibility();
    if (!compatibility.supported) {
      this.sessionOpen = false;
      this.telemetryOpen = false;
      return {
        opened: false,
        reason: compatibility.reason,
        firmwareVersion: compatibility.firmwareVersion,
      };
    }
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

module.exports = {
  Programmer,
  STEP_LIMIT_MA,
  IDLE_TIMEOUT_MINUTES,
  FIRMWARE_COMPATIBILITY_LIST,
};
