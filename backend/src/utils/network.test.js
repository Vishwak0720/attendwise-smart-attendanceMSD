import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/attendance_test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-to-pass-validation';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.RP_ID = 'localhost';
process.env.RP_NAME = 'Attendance test';
process.env.ALLOWED_IP_CIDRS = '127.0.0.1/32,2001:db8::/32';
process.env.TRUSTED_PROXIES = '';

const { isAuthorizedNetwork } = await import('./network.js');

test('allows an exact IPv4 address and IPv4-mapped loopback', () => {
  assert.equal(isAuthorizedNetwork('127.0.0.1'), true);
  assert.equal(isAuthorizedNetwork('::ffff:127.0.0.1'), true);
});

test('allows configured network ranges but rejects unrelated and invalid addresses', () => {
  assert.equal(isAuthorizedNetwork('2001:db8::5'), true);
  assert.equal(isAuthorizedNetwork('10.0.0.2'), false);
  assert.equal(isAuthorizedNetwork('not-an-ip'), false);
  assert.equal(isAuthorizedNetwork(undefined), false);
});
