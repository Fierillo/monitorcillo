async function main(): Promise<void> {
    if (!process.env.NEON_URL) {
        throw new Error('NEON_URL is required to run sync. Configure it as a GitHub Actions secret.');
    }

    const { runSync } = await import('../lib/sync');
    const results = await runSync();
    console.log(JSON.stringify({ success: true, results }, null, 2));
}

main().catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
});
