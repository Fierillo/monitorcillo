const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'data', 'cache', 'poder-adquisitivo.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Calcular factor de normalización (primer valor de negro)
const primerValorNegro = data.data[0].negro;
const factor = 100 / primerValorNegro;

console.log(`Factor de normalización: ${factor}`);
console.log(`Primer valor original: ${primerValorNegro}`);
console.log(`Primer valor normalizado: ${primerValorNegro * factor}`);

// Normalizar todos los valores de negro
data.data.forEach((item, index) => {
  if (item.negro !== undefined) {
    item.negro = item.negro * factor;
  }
});

// Guardar archivo actualizado
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log(`\nArchivo actualizado. Total de registros procesados: ${data.data.length}`);
