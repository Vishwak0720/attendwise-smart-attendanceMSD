import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceInMeters, isValidCoordinates } from './errors.js';

test('validates geographic coordinate ranges', () => {
  assert.equal(isValidCoordinates(37.7749, -122.4194), true);
  assert.equal(isValidCoordinates(91, 0), false);
  assert.equal(isValidCoordinates(0, -181), false);
  assert.equal(isValidCoordinates(Number.NaN, 0), false);
});

test('calculates zero distance for the same point', () => {
  assert.equal(distanceInMeters(
    { latitude: 37, longitude: -122 },
    { latitude: 37, longitude: -122 }
  ), 0);
});

test('calculates the distance between nearby points in metres', () => {
  const distance = distanceInMeters(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.001 }
  );
  assert.ok(distance > 110 && distance < 112);
});
