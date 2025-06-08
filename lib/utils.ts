/**
 * Sleep for a specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms)); 