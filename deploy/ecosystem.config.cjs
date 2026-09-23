// PM2 — executar a partir da raiz do repositório: pm2 start deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "ara-api",
      cwd: "./backend",
      script: "dist/server.js",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
    },
  ],
};
