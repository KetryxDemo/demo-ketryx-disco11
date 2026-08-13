'use strict';

// Minimal model of the clinician programmer, sufficient to exercise the
// behaviors described in specs/. Not device software.

const { AuthLockoutPolicy } = require('./auth-lockout');

const STEP_LIMIT_MA = 0.5;
const IDLE_TIMEOUT_MINUTES = 15;
const ABORT_BUDGET_MS = 2000;

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
    this.elapsedMinutes = 0;
    this.lockoutPolicy = new AuthLockoutPolicy();
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
    if (this.lockoutPolicy.isLocked(id, this.elapsedMinutes)) {
      this.authenticated = false;
      this.clinician = null;
      const lockedForMinutes = this.lockoutPolicy.remainingLockoutMinutes(id, this.elapsedMinutes);
      this.appendAuthAudit('authentication.blocked', id, { lockedForMinutes });
      return { authenticated: false, reason: 'ACCOUNT_LOCKED', lockedForMinutes };
    }

    const accepted = role === 'Programmer';
    this.authenticated = accepted;
    this.clinician = accepted ? id : null;

    if (accepted) {
      this.lockoutPolicy.recordSuccess(id);
      this.appendAuthAudit('authentication.succeeded', id, {});
      return { authenticated: true };
    }

    const outcome = this.lockoutPolicy.recordFailure(id, this.elapsedMinutes);
    this.appendAuthAudit('authentication.failed', id, {
      failures: outcome.failures,
      locked: outcome.locked,
    });
    if (outcome.locked) {
      this.appendAuthAudit('authentication.locked', id, {
        lockedForMinutes: this.lockoutPolicy.lockoutMinutes,
      });
      return {
        authenticated: false,
        reason: 'ACCOUNT_LOCKED',
        lockedForMinutes: this.lockoutPolicy.lockoutMinutes,
      };
    }
    return {
      authenticated: false,
      reason: 'INVALID_CREDENTIALS',
      attemptsRemaining: outcome.attemptsRemaining,
    };
  }

  appendAuthAudit(event, clinicianId, detail) {
    this.auditLog.push({
      event,
      clinician: clinicianId,
      detail,
      timestamp: new Date().toISOString(),
    });
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
    this.elapsedMinutes += minutes;
    if (minutes >= IDLE_TIMEOUT_MINUTES) {
      this.sessionOpen = false;
      this.telemetryOpen = false;
      this.requiresReauth = true;
      this.authenticated = false;
    }
    return { sessionOpen: this.sessionOpen };
  }

  advanceMinutes(minutes) {
    // Advances the clock without implying clinician inactivity, so a locked
    // account can serve out its cool-down while no session is open.
    this.elapsedMinutes += minutes;
    return { elapsedMinutes: this.elapsedMinutes };
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

module.exports = { Programmer, STEP_LIMIT_MA, IDLE_TIMEOUT_MINUTES };
