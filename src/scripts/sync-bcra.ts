async function fetchBcraData() {
    try {
        const res = await fetch('https://api.bcra.gob.ar/estadisticas/v2.0/principalesvariables');
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        console.log(data);
    } catch (error) {
        console.error(error);
    }
}

fetchBcraData();
