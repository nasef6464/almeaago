export const isStagingEnv=import.meta.env.VITE_APP_ENV==='staging'&&typeof location!=='undefined'&&!['localhost','127.0.0.1'].includes(location.hostname);
