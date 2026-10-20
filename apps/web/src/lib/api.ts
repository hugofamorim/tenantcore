
export interface HealthResponse {
    status: 'ok';
    service: string;
    database: 'connected';
    timestamp: string;
  }
  
  export async function getApiHealth(): Promise<HealthResponse> {
    const apiUrl = process.env.API_URL;
  
    if (!apiUrl) {
      throw new Error('API_URL is not configured');
    }
  
    const response = await fetch(`${apiUrl}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
  
    const data: unknown = await response.json();
  
    if (
      typeof data !== 'object' ||
      data === null ||
      !('status' in data) ||
      data.status !== 'ok' ||
      !('database' in data) ||
      data.database !== 'connected'
    ) {
      throw new Error('API returned an unhealthy response');
    }
  
    return data as HealthResponse;
  }
  