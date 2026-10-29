# Relevo entre herramientas (Claude en la nube, Claude en el PC, Antigravity)

Varias herramientas trabajan en este repositorio **de a una por vez**: cuando a una se le acaban los créditos, sigue
otra. Este archivo es el pase de la posta. **Quien termina lo actualiza; quien empieza lo lee.**

## Reglas del relevo
1. **Rama de trabajo común: `desarrollo`.** Todas las herramientas trabajan ahí. `main` es lo estable: de ahí sale
   lo que se instala en Contabo, así que solo se le suma `desarrollo` cuando todo pasa (ver «Subir a main»).
2. **Al empezar:** `git checkout desarrollo && git pull`, lee la sección «Estado actual» de abajo y `AGENTS.md`.
   Confirma con `git branch --show-current` que NO estás en `main`.
3. **Mientras trabajas:** commits pequeños y frecuentes con mensaje en español. Nada de trabajo sin commit al
   cerrar: si se acaban los créditos a medio camino, lo que no está subido se pierde.
4. **Al terminar (o antes de quedarte sin créditos):** commit, `git push`, y reescribe «Estado actual» (abajo).
5. **Nunca dos herramientas a la vez** sobre la misma rama. Si dudas, `git pull` y mira `git log -5`.
6. **No se sube:** `.env`, `backend/data/`, `.venv`, `node_modules`, `.next`, claves ni contraseñas.
7. **Nada de `git push --force`, `git reset --hard` ni borrar ramas** sin permiso del dueño.
8. **Servidor (Contabo):** solo lo toca el dueño, o una herramienta con su permiso explícito y solo lectura.

## Subir a main (lo hace quien tenga créditos y haya verificado)
Con `desarrollo` al día y todas las verificaciones de `AGENTS.md` pasando:
```
git checkout main && git pull
git merge --no-ff desarrollo -m "Integra desarrollo: <resumen>"
git push origin main
git checkout desarrollo
```
Si hay conflictos, resolverlos conservando ambos cambios y volver a correr las verificaciones antes de subir.

## Estado actual  (reescríbelo al terminar cada sesión)
- **Última herramienta:** Claude (nube) · **Fecha:** 2026-10-29
- **Hecho:** ver las secciones 12 a 20 de `docs/BITACORA.md`; `main` y `desarrollo` están iguales.
- **En curso / a medias:** nada.
- **Siguiente paso sugerido:** medir el rendimiento del mapa con `?diagnostico` en el PC y decidir si hace falta un
  solo lienzo 3D; después asignar vehículo a cada envío.
- **Verificaciones al cerrar:** 221 pruebas de la API y 15 de navegador en verde.
- **Avisos:** Contabo debe tener `main` desplegado; confirmarlo con `git log --oneline -1` en el servidor.
