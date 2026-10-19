try {
  process.loadEnvFile();
} catch {
  // No .env file; rely on the real environment.
}

const { createApp } = await import('./src/app.js');
const { isConfigured } = await import('./src/tmdb.js');

const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => {
  console.log(`Box Office Game running at http://localhost:${port}`);
  if (!isConfigured()) {
    console.log('TMDB_API_KEY not set: plot, genre, director and cast details will be unavailable.');
  }
});
