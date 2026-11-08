// ecosystem.config.cjs
// PM2 Configuration for 24/7 Dedicated Server Hosting
module.exports = {
  apps: [
    {
      name: 'apex-dedicated-server',
      script: './server/dedicated_server.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
    },
  ],
};
