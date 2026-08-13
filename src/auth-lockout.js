'use strict';

// Failed-authentication lockout policy for the clinician programmer.
// Counts consecutive failed authentication attempts per clinician id and
// refuses further attempts for a cool-down period once the threshold is hit.
// Not device software.

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

class AuthLockoutPolicy {
  constructor({ maxFailedAttempts = MAX_FAILED_ATTEMPTS, lockoutMinutes = LOCKOUT_MINUTES } = {}) {
    this.maxFailedAttempts = maxFailedAttempts;
    this.lockoutMinutes = lockoutMinutes;
    // clinicianId -> { failures, lockedAtMinute }
    this.counters = new Map();
  }

  counterFor(clinicianId) {
    if (!this.counters.has(clinicianId)) {
      this.counters.set(clinicianId, { failures: 0, lockedAtMinute: null });
    }
    return this.counters.get(clinicianId);
  }

  isLocked(clinicianId, nowMinute) {
    const counter = this.counterFor(clinicianId);
    if (counter.lockedAtMinute === null) {
      return false;
    }
    if (nowMinute - counter.lockedAtMinute >= this.lockoutMinutes) {
      // The cool-down elapsed, so the clinician gets a clean slate.
      counter.lockedAtMinute = null;
      counter.failures = 0;
      return false;
    }
    return true;
  }

  remainingLockoutMinutes(clinicianId, nowMinute) {
    const counter = this.counterFor(clinicianId);
    if (counter.lockedAtMinute === null) {
      return 0;
    }
    return Math.max(0, this.lockoutMinutes - (nowMinute - counter.lockedAtMinute));
  }

  recordFailure(clinicianId, nowMinute) {
    const counter = this.counterFor(clinicianId);
    counter.failures += 1;
    if (counter.failures >= this.maxFailedAttempts) {
      counter.lockedAtMinute = nowMinute;
      return { locked: true, failures: counter.failures, attemptsRemaining: 0 };
    }
    return {
      locked: false,
      failures: counter.failures,
      attemptsRemaining: this.maxFailedAttempts - counter.failures,
    };
  }

  recordSuccess(clinicianId) {
    const counter = this.counterFor(clinicianId);
    counter.failures = 0;
    counter.lockedAtMinute = null;
  }
}

module.exports = { AuthLockoutPolicy, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES };
