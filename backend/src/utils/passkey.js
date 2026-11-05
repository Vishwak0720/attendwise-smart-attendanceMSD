import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server';
import { config } from '../config.js';

const relyingParty = {
  rpID: config.RP_ID,
  rpName: config.RP_NAME,
  origin: config.CLIENT_ORIGIN
};

export function registrationOptions(user) {
  return generateRegistrationOptions({
    ...relyingParty,
    userID: new TextEncoder().encode(user._id.toString()),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: user.passkeys.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required'
    }
  });
}

export function authenticationOptions(user) {
  return generateAuthenticationOptions({
    ...relyingParty,
    allowCredentials: user.passkeys.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports
    })),
    userVerification: 'required'
  });
}

export function verifyRegistration(response, challenge) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: relyingParty.origin,
    expectedRPID: relyingParty.rpID,
    requireUserVerification: true
  });
}

export function verifyAuthentication(response, credential, challenge) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: relyingParty.origin,
    expectedRPID: relyingParty.rpID,
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(credential.publicKey, 'base64url'),
      counter: credential.counter,
      transports: credential.transports
    },
    requireUserVerification: true
  });
}
