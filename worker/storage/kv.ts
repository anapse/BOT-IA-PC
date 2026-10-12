export const getStorage = (env: any) => {
  return {
    async getConfig(): Promise<any> {
      const config = await env.WORKER_KV.get('config');
      return config ? JSON.parse(config) : { agents: [] };
    },
    async saveConfig(config: any) {
      await env.WORKER_KV.put('config', JSON.stringify(config));
    }
  };
};
