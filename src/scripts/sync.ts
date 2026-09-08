async function main(): Promise<void> {
    if (!process.env.NEON_URL) {
        throw new Error('NEON_URL is required to run sync. Configure it as a GitHub Actions secret.');
    }

    const { runSync } = await import('../lib/sync');
    const report = await runSync();
    const success = report.failed.length === 0;

    console.log(JSON.stringify({
        success,
        updated: report.updated,
        failed: report.failed,
        results: report.results,
    }, null, 2));

    if (!success) {
        console.error(`Updated: ${report.updated.join(', ') || 'none'}`);
        console.error(`Failed: ${report.failed.map(item => `${item.key} (${item.error})`).join('; ')}`);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
});
