import { api } from '../../config/api';

export const executionService = {
  async execute(code: string, language = 'javascript') {
    const { data } = await api.post('/execute', { code, language });
    return data.data as {
      stdout: string;
      stderr: string;
      executionTime: number;
      success: boolean;
    };
  },
};
