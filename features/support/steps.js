// Step definitions for the NeuroCue Clinician Programmer acceptance suite.
// The programmer logic under test lives in src/programmer.js.
const assert = require('assert');
const { Given, When, Then } = require('@cucumber/cucumber');
const { Programmer } = require('../../src/programmer');
const { buildBillOfMaterials } = require('../../src/bom');

Given('a clinician who has not authenticated', function () {
  this.programmer = new Programmer();
});

Given('an open programming session', function () {
  this.programmer = new Programmer();
  this.programmer.authenticate({ role: 'Programmer' });
  this.programmer.confirmPatientMatch();
  this.session = this.programmer.openSession();
});

Given('a proposed amplitude of {float} mA', function (mA) {
  this.programmer = Programmer.inOpenSession();
  this.pending = this.programmer.propose({ amplitudeMa: mA });
});

Given('a current amplitude of {float} mA', function (mA) {
  this.programmer = Programmer.inOpenSession({ amplitudeMa: mA });
});

Given('an implant reporting a maximum amplitude of {float} mA', function (mA) {
  this.programmer = Programmer.inOpenSession({ ceilingMa: mA });
});

Given('an in-progress parameter change', function () {
  this.programmer = Programmer.inOpenSession();
  this.pending = this.programmer.propose({ amplitudeMa: 2.5 });
});

Given('an authenticated clinician', function () {
  this.programmer = Programmer.inOpenSession({ clinician: 'dr-reyes' });
});

Given('an implant whose serial has not been confirmed against the patient record', function () {
  this.programmer = new Programmer();
  this.programmer.authenticate({ role: 'Programmer' });
});

When('they attempt to open a programming session', function () {
  this.result = this.programmer.openSession();
});

When('the clinician attempts to open a programming session', function () {
  this.result = this.programmer.openSession();
});

When('{int} minutes pass with no clinician interaction', function (minutes) {
  this.result = this.programmer.advanceIdleMinutes(minutes);
});

When('the clinician does not confirm the change', function () {
  this.result = this.programmer.abandonPending();
});

When('the clinician requests {float} mA in one adjustment', function (mA) {
  this.result = this.programmer.requestAmplitude(mA);
});

When('the clinician requests {float} mA', function (mA) {
  this.result = this.programmer.requestAmplitude(mA);
});

When('the telemetry link is lost', function () {
  this.result = this.programmer.loseTelemetry();
});

When('they commit an amplitude change from {float} mA to {float} mA', function (from, to) {
  this.programmer.setAmplitude(from);
  this.result = this.programmer.commitAmplitude(to);
});

Then('the session is refused', function () {
  assert.strictEqual(this.result.opened, false);
});

Then('no telemetry link is established', function () {
  assert.strictEqual(this.programmer.telemetryOpen, false);
});

Then('the session is closed', function () {
  assert.strictEqual(this.result.sessionOpen, false);
});

Then('resuming requires a fresh authentication', function () {
  assert.strictEqual(this.programmer.requiresReauth, true);
});

Then('no value is transmitted to the implant', function () {
  assert.strictEqual(this.programmer.lastTransmitted, null);
});

Then('the pending change is discarded', function () {
  assert.strictEqual(this.programmer.pending, null);
});

Then('the adjustment is rejected', function () {
  assert.strictEqual(this.result.accepted, false);
});

Then('the clinician is told the per-step limit was exceeded', function () {
  assert.strictEqual(this.result.reason, 'STEP_LIMIT_EXCEEDED');
});

Then('the clinician is told the implant ceiling was exceeded', function () {
  assert.strictEqual(this.result.reason, 'CEILING_EXCEEDED');
});

Then('the change is aborted within {int} seconds', function (seconds) {
  assert.strictEqual(this.result.aborted, true);
  assert.ok(this.result.abortLatencyMs <= seconds * 1000);
});

Then('the implant retains its last committed parameter set', function () {
  assert.strictEqual(this.programmer.committed.amplitudeMa, this.programmer.lastCommittedAmplitude);
});

Then('an audit entry records the prior value, the new value, the timestamp, and the clinician identity', function () {
  const entry = this.programmer.auditLog[this.programmer.auditLog.length - 1];
  assert.ok(entry.priorValue !== undefined);
  assert.ok(entry.newValue !== undefined);
  assert.ok(entry.timestamp);
  assert.ok(entry.clinician);
});

Then('the session is blocked', function () {
  assert.strictEqual(this.result.opened, false);
});

Then('the clinician is prompted to confirm the patient-to-implant match', function () {
  assert.strictEqual(this.result.reason, 'PATIENT_MATCH_UNCONFIRMED');
});

// --- Telemetry session cryptography -------------------------------------

Given('an implant presenting a certificate that does not chain to the device CA', function () {
  this.programmer = new Programmer();
  this.handshake = { peerCertTrusted: false };
});

Given('two consecutive programming sessions with the same implant', function () {
  this.programmer = Programmer.inOpenSession();
  this.sessions = 2;
});

When('the programmer performs the telemetry handshake', function () {
  this.result = this.programmer.performHandshake(this.handshake);
});

When('session keys are derived for each', function () {
  this.keys = [];
  for (let i = 0; i < this.sessions; i += 1) {
    this.keys.push(this.programmer.deriveSessionKey(i));
  }
});

Then('the handshake is abandoned', function () {
  assert.strictEqual(this.result.established, false);
});

Then('no telemetry session is opened', function () {
  assert.strictEqual(this.programmer.telemetryOpen, false);
});

Then('the two session keys differ', function () {
  assert.notStrictEqual(this.keys[0], this.keys[1]);
});

// --- Third-party component inventory ------------------------------------

Given('a build of the programmer for a released version', function () {
  this.build = { version: '1.0.0' };
});

When('the build completes', function () {
  this.bom = buildBillOfMaterials(this.build.version);
});

Then('a CycloneDX bill of materials is published for that version', function () {
  assert.strictEqual(this.bom.bomFormat, 'CycloneDX');
  assert.strictEqual(this.bom.metadata.component.version, this.build.version);
});

Then('every third-party component is listed with a package URL and version', function () {
  assert.ok(this.bom.components.length > 0);
  for (const c of this.bom.components) {
    assert.ok(c.purl, 'component missing purl');
    assert.ok(c.version, 'component missing version');
  }
});

// --- Implant firmware compatibility screening ---------------------------

Given('an implant reporting firmware version {string}', function (version) {
  this.programmer = new Programmer();
  this.programmer.authenticate({ role: 'Programmer' });
  this.programmer.confirmPatientMatch();
  this.programmer.identifyImplant({ firmwareVersion: version });
});

When('a compatibility list adding firmware version {string} is loaded', function (version) {
  const current = this.programmer.compatibilityList;
  this.result = this.programmer.loadCompatibilityList({
    listVersion: '2026.09',
    supportedFirmwareVersions: current.supportedFirmwareVersions.concat([version]),
  });
});

Then('no programming session is opened', function () {
  assert.strictEqual(this.result.opened, false);
  assert.strictEqual(this.programmer.sessionOpen, false);
});

Then('the clinician is told the implant firmware is unsupported', function () {
  assert.strictEqual(this.result.reason, 'FIRMWARE_UNSUPPORTED');
  assert.strictEqual(this.result.firmwareVersion, '2.9.4');
});

Then('the programming session is opened', function () {
  assert.strictEqual(this.result.opened, true);
  assert.strictEqual(this.programmer.sessionOpen, true);
});
