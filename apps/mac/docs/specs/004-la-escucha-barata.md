# 004 — La escucha barata: Live 1 ⇄ Soniox + Jev ⇄ Sol

Estado: **en verde** (2026-10-01) · Rama: `samuel/mac-funciona` · El diseño y sus medidas están en
[`docs/ESCUCHA-BARATA.md`](../ESCUCHA-BARATA.md).

Tras un rato sin interacción, Live 1 decide si pasar a escucha pasiva: Soniox transcribe, Jev juzga
cada frase con una pregunta cerrada, y Sol planea lo que haya que hacer sin voz. El ciclo es fontanería:
va al registro (categoría `Passive`) y nunca al notch.

## Promesas

| # | Promesa | Juez |
|---|---|---|
| 401 | Jev juzga cada frase con una sola pregunta cerrada y umbrales calibrados | `testJevJudgesEachPhraseWithOneClosedQuestionAndCalibratedThresholds` |
| 402 | Los cuadros de Soniox se vuelven frases que cierran en el punto final | `testSonioxFramesBecomePhrasesThatCloseAtTheEndpoint` |
| 403 | A Live se le pregunta una vez tras el silencio, y nunca mientras está ocupada | `testLiveIsAskedOnceAfterTheQuietStretchAndNeverWhileBusy` |
| 404 | Live es dueña del relevo, y se le cuenta lo que pasó | `testLiveOwnsTheHandoverAndIsToldWhatHappened` |
| 405 | Sol planea con herramientas hasta contestar en texto | `testSolPlansWithToolsUntilItAnswersInText` |
| 406 | La carrera de Jev toma la primera respuesta útil y solo falla si fallan todas | `testJevRaceTakesTheFirstUsableAnswerAndFailsOnlyWhenAllFail` |
