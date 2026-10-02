# 005 — Ü se entrega a quien la prueba

Estado: **en verde** (2026-10-02) · Rama: `samuel/mac-dmg-pruebas`

`./empaquetar.sh` arma `.artifacts/U-Mac-pruebas.dmg`: la app universal (Apple Silicon + Intel), firmada
con la identidad estable de este Mac, un acceso a Aplicaciones y un LÉEME para abrirla la primera vez.
Sin la cuenta de Apple Developer no hay sello de Apple: cada persona aprueba la app una vez en
Ajustes del Sistema → Privacidad y seguridad. Como la firma es la misma en cada versión, los permisos
que dio (Accesibilidad, Grabación de pantalla, Micrófono) sobreviven a las actualizaciones.

Mientras Graph no entregue una credencial de voz que sirva, el disco lleva una **temporal**: se lee de
fuera del repo (es público), viaja enmascarada —no cifrada: quien tenga el disco puede sacarla— y la app
deja de usarla en su fecha. Lo que la persona guarde en su Llavero va siempre primero.

## Promesas

| # | Promesa | Juez |
|---|---|---|
| 501 | La credencial que viaja en la app no va en claro, solo se abre entera y solo hasta su fecha | `testBundledCredentialOpensOnlyWholeAndOnlyUntilItsDate` |
| 502 | Solo una copia en Aplicaciones se deja encendida para el próximo inicio de sesión, y escribe su agente una vez | `testOnlyACopyInApplicationsKeepsItselfOnAndWritesItsAgentOnce` |

## Lo que no juzga el corredor

- Que el disco monta, que la app dentro está firmada con la identidad estable y es universal: lo
  comprueba `empaquetar.sh` antes de entregar el disco, y se niega a empaquetar una firma ad hoc.
- Que la credencial del disco responde: `--voice-keys-test` la prueba aparte contra Live 1 (fila
  `pruebas`), sin micrófono.
- El primer arranque en otro Mac (el aviso de macOS y «Abrir igualmente») solo se puede ver en ese Mac.
