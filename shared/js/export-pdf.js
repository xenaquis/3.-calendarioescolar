/* export-pdf.js — Generar PDF desde datos
   Copiar a public/js/ cuando el sitio necesite PDFs (calculafiniquito).
   Usa jsPDF via CDN.
   Uso: ExportPDF.generate(config) */
var ExportPDF = (function () {
  var CDN = 'https://cdn.jsdelivr.net/npm/jspdf@2/dist/jspdf.umd.min.js';

  function loadLib() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.onload = function () { resolve(window.jspdf); };
      s.onerror = function () { reject(new Error('Failed to load jsPDF')); };
      document.head.appendChild(s);
    });
  }

  /* Generar PDF simple con título, tabla de datos y nota al pie.
     config = {
       title: 'Desglose de Finiquito',
       subtitle: 'Fecha: 11 marzo 2026',
       rows: [ { label: 'Indemnización', value: '$2.400.000' }, ... ],
       total: { label: 'TOTAL', value: '$4.136.666' },
       footer: 'Valores UF al 11/03/2026. Fuente: mindicador.cl',
       filename: 'finiquito.pdf'
     } */
  function generate(config) {
    return loadLib().then(function (jspdf) {
      var doc = new jspdf.jsPDF();
      var y = 20;

      // Título
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(config.title || 'Documento', 20, y);
      y += 10;

      // Subtítulo
      if (config.subtitle) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(config.subtitle, 20, y);
        y += 12;
      }

      // Línea separadora
      doc.setDrawColor(200);
      doc.line(20, y, 190, y);
      y += 8;

      // Filas
      doc.setFontSize(11);
      (config.rows || []).forEach(function (row) {
        doc.setFont(undefined, 'normal');
        doc.text(row.label, 20, y);
        doc.text(row.value, 190, y, { align: 'right' });
        y += 8;
      });

      // Total
      if (config.total) {
        y += 2;
        doc.setDrawColor(0);
        doc.line(20, y, 190, y);
        y += 8;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(13);
        doc.text(config.total.label, 20, y);
        doc.text(config.total.value, 190, y, { align: 'right' });
        y += 12;
      }

      // Footer
      if (config.footer) {
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(128);
        doc.text(config.footer, 20, 280);
      }

      doc.save(config.filename || 'documento.pdf');
    });
  }

  return { generate: generate };
})();
