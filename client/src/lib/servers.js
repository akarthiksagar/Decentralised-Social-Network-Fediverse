const defaultApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const defaultDomain =
  import.meta.env.VITE_SERVER_DOMAIN || new URL(defaultApiUrl).hostname || 'localhost';
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

function normalizeServer(server, index = 0) {
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

export function findServerByDomain(domain) {
  return servers.find((server) => server.domain === domain) || servers[0];
}

export function getDefaultServer() {
  return servers[0];
}
