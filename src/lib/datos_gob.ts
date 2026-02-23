import https from 'https';

export async function fetchSeries(ids: string): Promise<any[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${ids}&limit=5000&format=json`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.data || []);
                    } catch {
                        resolve([]);
                    }
                } else {
                    resolve([]);
                }
            });
        }).on('error', () => {
            resolve([]);
        });
    });
}
