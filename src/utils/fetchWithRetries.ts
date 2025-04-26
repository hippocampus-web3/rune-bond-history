import axios, { AxiosError } from 'axios';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export async function fetchWithRetries<T>(url: string): Promise<T> {
    let lastError: AxiosError | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.get<T>(url);
            return response.data;
        } catch (error) {
            lastError = error as AxiosError;
            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            }
        }
    }
    
    throw lastError || new Error('Failed to fetch data after multiple attempts');
} 