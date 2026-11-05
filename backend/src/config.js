import dotenv from 'dotenv';
import { z } from 'zod';
import ipaddr from 'ipaddr.js';

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_ORIGIN: z.string().url(),
  RP_ID: z.string().min(1),
  RP_NAME: z.string().min(1),
  COLLEGE_LATITUDE: z.string().optional().default(''),
  COLLEGE_LONGITUDE: z.string().optional().default(''),
  COLLEGE_RADIUS_METERS: z.coerce.number().positive().default(100),
  ALLOWED_IP_CIDRS: z.string().optional().default(''),
  TRUSTED_PROXIES: z.string().optional().default('')
});

export const config = schema.parse(process.env);
export const allowedNetworks = config.ALLOWED_IP_CIDRS
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
export const trustedProxies = config.TRUSTED_PROXIES
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
export const collegeLocation = {
  latitude: config.COLLEGE_LATITUDE === '' ? null : Number(config.COLLEGE_LATITUDE),
  longitude: config.COLLEGE_LONGITUDE === '' ? null : Number(config.COLLEGE_LONGITUDE)
};

if ((collegeLocation.latitude === null) !== (collegeLocation.longitude === null)
  || (collegeLocation.latitude !== null
    && (!Number.isFinite(collegeLocation.latitude) || collegeLocation.latitude < -90 || collegeLocation.latitude > 90))
  || (collegeLocation.longitude !== null
    && (!Number.isFinite(collegeLocation.longitude) || collegeLocation.longitude < -180 || collegeLocation.longitude > 180))) {
  throw new Error('Set both college coordinates to valid latitude/longitude values in backend/.env.');
}

for (const network of [...allowedNetworks, ...trustedProxies]) {
  try {
    if (network.includes('/')) ipaddr.parseCIDR(network);
    else ipaddr.parse(network);
  } catch (error) {
    throw new Error(`Invalid network CIDR "${network}" in backend/.env: ${error.message}`);
  }
}
