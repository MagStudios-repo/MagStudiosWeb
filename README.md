# MagStudios Web

Sitio oficial de MagStudios y de MagPlayer+. Está preparado para desplegarse
como proyecto estático en Vercel.

## Desarrollo y publicación

- `index.html`: página principal de MagStudios.
- `magplayer.html`: presentación de MagPlayer+ y sus modos móvil y escritorio.
- `version.json`: manifiesto del canal de actualizaciones. Se mantiene sin una
  publicación activa hasta que exista un binario oficial firmado.
- `vercel.json`: evita que Vercel entregue un manifiesto de actualización
  almacenado en caché.

Las capturas de producto se organizan por plataforma en `assets/capturas/`.
No se deben publicar APK ni paquetes Debian sin actualizar primero su hash
SHA-256 en el manifiesto oficial.
