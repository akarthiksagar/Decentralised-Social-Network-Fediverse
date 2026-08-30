const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const knownServersStorageKey = 'knownServers';

function getDefaultDomain() {
  if (import.meta.env.VITE_SERVER_DOMAIN) return import.meta.env.VITE_SERVER_DOMAIN;

  try {
    return new URL(defaultApiUrl).hostname;
  } catch {
    return 'localhost';
  }
}

const defaultDomain = getDefaultDomain();
const defaultName = import.meta.env.VITE_SERVER_NAME || defaultDomain;

export function normalizeApiUrl(apiUrl) {
  return (apiUrl || defaultApiUrl).trim().replace(/\/$/, '');
}

function parseServerDirectory() {
  const rawDirectory = import.meta.env.VITE_SERVER_DIRECTORY;
  if (!rawDirectory) return [];

  try {
    const parsed = JSON.parse(rawDirectory);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeServer(server, index = 0) {
  const domain = server.domain || server.id || defaultDomain;

  return {
    id: server.id || domain,
    name: server.name || domain,
    domain,
    apiUrl: normalizeApiUrl(server.apiUrl || server.api_url || defaultApiUrl),
    category: server.category || 'Server',
    registrations: server.registrations || 'Unknown',
    accent: server.accent || 'bg-blue-500',
    description: server.description || `Connect to ${domain}.`,
    rules: Array.isArray(server.rules) ? server.rules : [],
    order: Number.isFinite(server.order) ? server.order : index,
  };
}

export const servers = (
  parseServerDirectory().length
    ? parseServerDirectory()
    : [
        {
          id: defaultDomain,
          name: defaultName,
          domain: defaultDomain,
          apiUrl: defaultApiUrl,
          registrations: 'Open',
          description: `Connect to ${defaultDomain}.`,
        },
      ]
)
  .map(normalizeServer)
  .sort((a, b) => a.order - b.order);

export const categories = ['All', ...new Set(servers.map((server) => server.category))];

export function mergeServers(...serverGroups) {
  const seen = new Set();

  return serverGroups
    .flat()
    .filter(Boolean)
    .map(normalizeServer)
    .filter((server) => {
      const key = `${server.domain}|${server.apiUrl}`;
      if (seen.has(server.domain) || seen.has(server.apiUrl) || seen.has(key)) return false;
      seen.add(server.domain);
      seen.add(server.apiUrl);
      seen.add(key);
      return true;
    });
}

export function getKnownServers() {
  if (typeof localStorage === 'undefined') return [];

  try {
    const savedServers = JSON.parse(localStorage.getItem(knownServersStorageKey) || '[]');
    return Array.isArray(savedServers) ? savedServers.map(normalizeServer) : [];
  } catch {
    return [];
  }
}

export function rememberServers(serverList) {
  const mergedServers = mergeServers(serverList, getKnownServers());

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(knownServersStorageKey, JSON.stringify(mergedServers));
  }

  return mergedServers;
}

export function getAvailableServers() {
  return mergeServers(getKnownServers(), servers);
}

export function findServerByDomain(domain) {
  const availableServers = getAvailableServers();
  return availableServers.find((server) => server.domain === domain) || availableServers[0];
}

export function getDefaultServer() {
  return getAvailableServers()[0] || servers[0];
}
