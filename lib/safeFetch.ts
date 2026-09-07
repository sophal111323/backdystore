/**
 * Safe fetch wrapper that uses the `undici` npm package with an explicit Agent/Dispatcher,
 * avoiding Node 25's assertion bug and dispatcher initialization errors.
 */
import {
  fetch as undiciFetch,
  Agent,
  getGlobalDispatcher,
  setGlobalDispatcher,
} from "undici";

let defaultAgent: Agent | null = null;
function getAgent(): Agent {
  if (!defaultAgent) {
    defaultAgent = new Agent({
      connect: {
        timeout: 10000,
      },
    });
    try {
      if (!getGlobalDispatcher()) {
        setGlobalDispatcher(defaultAgent);
      }
    } catch {
      // ignore
    }
  }
  return defaultAgent;
}

export async function safeFetch(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  const agent = getAgent();
  const res = await undiciFetch(url as any, {
    ...(init as any),
    dispatcher: agent,
  });
  return res as unknown as Response;
}
