import fs from 'fs/promises';
import path from 'path';

import https from 'https';

const API_URL = 'https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/';
// The user provided the image `BCRA: Base monetaria amplia (%PBI).png` indicating the structure and data needed.
// According to BCRA API, Base Monetaria Amplia would likely be a composite or specific metric from Monetarias endpoint.
// We need to find the correct `idVariable`.

async function searchVariables() {
    try {
        const agent = new https.Agent({ rejectUnauthorized: false });
        // Next.js native fetch polyfill takes node-fetch options under 'agent' or next specific options.
        // It's just a TS script anyway, we can use built-in fetch if node version > 18.
        const response = await fetch(API_URL, {
            // @ts-ignore
            agent
        });
        const data = await response.json();

        const variables = data.results.filter((v: any) =>
            v.descripcion.toLowerCase().includes('base monetaria') ||
            v.descripcion.toLowerCase().includes('pasivos remunerados')
        );

        console.log(variables);

    } catch (e) {
        console.error(e);
    }
}

searchVariables();
