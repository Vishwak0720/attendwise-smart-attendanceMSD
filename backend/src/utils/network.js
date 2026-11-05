import ipaddr from 'ipaddr.js';
import { allowedNetworks } from '../config.js';

export function isAuthorizedNetwork(address) {
  if (!address || allowedNetworks.length === 0) return false;
  let clientAddress;
  try {
    clientAddress = ipaddr.process(address);
  } catch {
    return false;
  }

  return allowedNetworks.some((network) => {
    try {
      const [rangeAddress, prefix] = network.includes('/')
        ? ipaddr.parseCIDR(network)
        : [ipaddr.parse(network), ipaddr.parse(network).kind() === 'ipv4' ? 32 : 128];
      return clientAddress.kind() === rangeAddress.kind()
        && clientAddress.match(rangeAddress, prefix);
    } catch (error) {
      throw new Error(`Invalid ALLOWED_IP_CIDRS entry "${network}": ${error.message}`);
    }
  });
}
