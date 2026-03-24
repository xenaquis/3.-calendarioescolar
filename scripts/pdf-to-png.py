#!/usr/bin/env python3
"""
pdf-to-png.py — Convierte PDFs regionales del Mineduc a PNG usando PyMuPDF.

Uso:
  python scripts/pdf-to-png.py --region=aysen
  python scripts/pdf-to-png.py --all
  python scripts/pdf-to-png.py --region=metropolitana --dpi=150 --output-dir=data/snapshots

Busca PDFs con nombre mineduc-{region}.pdf en --pdf-dir (default: data/extraction-tests).
Escribe PNGs en --output-dir (default: data/snapshots).
Salida JSON en stdout con manifest de conversion.
"""

import fitz  # PyMuPDF
import os
import sys
import argparse
import json

# Las 16 regiones en orden norte a sur
REGION_SLUGS = [
    'arica-y-parinacota',
    'tarapaca',
    'antofagasta',
    'atacama',
    'coquimbo',
    'valparaiso',
    'metropolitana',
    'ohiggins',
    'maule',
    'nuble',
    'biobio',
    'araucania',
    'los-rios',
    'los-lagos',
    'aysen',
    'magallanes',
]


def get_root():
    """Retorna el directorio raiz del proyecto (dos niveles arriba de este script)."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(script_dir)


def find_pdf(region, pdf_dir):
    """Busca el PDF de una region en el directorio especificado."""
    pdf_name = 'mineduc-{}.pdf'.format(region)
    pdf_path = os.path.join(pdf_dir, pdf_name)
    if os.path.isfile(pdf_path):
        return pdf_path
    return None


def convert_pdf_to_png(region, pdf_path, output_dir, dpi):
    """
    Convierte un PDF a PNGs, uno por pagina.

    Retorna dict con manifest de la conversion.
    """
    doc = fitz.open(pdf_path)
    matrix = fitz.Matrix(dpi / 72, dpi / 72)

    os.makedirs(output_dir, exist_ok=True)

    pngs = []
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        pixmap = page.get_pixmap(matrix=matrix)

        # Nombre: {region}-p{N}.png (1-indexed)
        png_name = '{}-p{}.png'.format(region, page_num + 1)
        png_path = os.path.join(output_dir, png_name)
        pixmap.save(png_path)
        pngs.append(png_name)

    doc.close()

    return {
        'region': region,
        'pdf': os.path.basename(pdf_path),
        'pages': len(pngs),
        'pngs': pngs,
    }


def main():
    root = get_root()

    parser = argparse.ArgumentParser(
        description='Convierte PDFs del Mineduc a PNG usando PyMuPDF.'
    )
    parser.add_argument('--region', help='Slug de region a procesar (ej: aysen)')
    parser.add_argument('--all', action='store_true', help='Procesar las 16 regiones')
    parser.add_argument('--dpi', type=int, default=300, help='Resolucion en DPI (default: 300)')
    parser.add_argument(
        '--output-dir',
        default=os.path.join(root, 'data', 'snapshots'),
        help='Directorio de salida para PNGs (default: data/snapshots)',
    )
    parser.add_argument(
        '--pdf-dir',
        default=os.path.join(root, 'data', 'extraction-tests'),
        help='Directorio con los PDFs fuente (default: data/extraction-tests)',
    )

    args = parser.parse_args()

    # Determinar cuales regiones procesar
    if args.all:
        regions = REGION_SLUGS
    elif args.region:
        if args.region not in REGION_SLUGS:
            print(
                'WARNING: {} no esta en la lista de regiones conocidas. Continuando igual.'.format(
                    args.region
                ),
                file=sys.stderr,
            )
        regions = [args.region]
    else:
        parser.print_help(sys.stderr)
        sys.exit(1)

    # Si no existe el pdf-dir principal, intentar data/snapshots como fallback
    pdf_dir = args.pdf_dir
    if not os.path.isdir(pdf_dir):
        fallback = os.path.join(root, 'data', 'snapshots')
        if os.path.isdir(fallback):
            print(
                'WARNING: {} no existe, usando {} como fallback.'.format(pdf_dir, fallback),
                file=sys.stderr,
            )
            pdf_dir = fallback

    results = []
    processed = 0

    for region in regions:
        pdf_path = find_pdf(region, pdf_dir)
        if pdf_path is None:
            print(
                'WARNING: No se encontro mineduc-{}.pdf en {}'.format(region, pdf_dir),
                file=sys.stderr,
            )
            continue

        try:
            manifest = convert_pdf_to_png(region, pdf_path, args.output_dir, args.dpi)
            results.append(manifest)
            processed += 1
            print(
                'OK: {} — {} paginas -> {}'.format(
                    region, manifest['pages'], ', '.join(manifest['pngs'])
                ),
                file=sys.stderr,
            )
        except Exception as e:
            print('ERROR al procesar {}: {}'.format(region, e), file=sys.stderr)

    # Manifest JSON a stdout
    if len(regions) == 1:
        # Modo region unica: manifest simple
        if results:
            print(json.dumps(results[0], ensure_ascii=False, indent=2))
        else:
            print(json.dumps({'error': 'PDF no encontrado', 'region': regions[0]}))
    else:
        # Modo --all: manifest completo
        print(
            json.dumps(
                {
                    'total_regions': processed,
                    'results': results,
                },
                ensure_ascii=False,
                indent=2,
            )
        )

    if processed == 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
