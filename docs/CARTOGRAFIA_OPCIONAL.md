# Extracto PMTiles de Colombia (opcional)

Desde la raíz del proyecto, con la [CLI `pmtiles`](https://docs.protomaps.com/pmtiles/cli) en el PATH:

```bash
node frontend/scripts/extraer-colombia.mjs "$ARCHIVO_FUENTE" /ruta/de/trabajo/colombia-z11.pmtiles
```

`ARCHIVO_FUENTE` es la ruta o URL HTTPS de un PMTiles vectorial *clustered*. Se puede elegir una edición
fechada de [Protomaps](https://maps.protomaps.com/builds). Conserva la procedencia, la fecha y la atribución
de OpenStreetMap. El script admite `PMTILES_BIN`, lee solo las teselas que cruzan los departamentos del GeoJSON
del proyecto hasta zoom 11 y verifica el archivo. Las teselas que cruzan la frontera contienen también
geometría vecina: la máscara visual y el recorte por tesela tienen funciones distintas.

Extracción comprobada: `https://build.protomaps.com/20261122.pmtiles` (v4.15.2), CLI v1.31.2,
78 peticiones de rango, 33 MB transferidos y **31.363.854 bytes** de salida verificados.
SHA-256: `333ac12848555706894b156abbc87e8c8c514d756dce03e2a7ca7da979ae1804`.

**Servicio opcional por el dueño.** Con `colombia-z11.pmtiles` instalado en `/srv/cartografia/`, este bloque
dentro del sitio de Caddy sirve el archivo en el mismo origen. `file_server` responde a rangos de bytes; no se
debe comprimir el archivo completo en tránsito. Cambia el nombre al publicar otra edición.

```caddyfile
handle_path /cartografia/* {
    root * /srv/cartografia
    header Content-Type application/octet-stream
    file_server
}
```

Verificación: `curl -i -r 0-126 https://DOMINIO/cartografia/colombia-z11.pmtiles`
debe responder **206**, `Content-Range: bytes 0-126/...` y 127 bytes de cuerpo.
Publicar el archivo por sí solo no cambia el mapa. Antes de activarlo hay que registrar el protocolo PMTiles
en MapLibre, seleccionar un estilo con los `source-layer` del archivo elegido (Protomaps y OpenMapTiles no son
intercambiables) y conservar la atribución. No precargar el archivo completo en el service worker.
