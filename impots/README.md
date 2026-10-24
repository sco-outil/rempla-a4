# Optimiseur d'impôts

Appli web mobile, en français, pour réduire légalement son impôt sur le revenu.

- Parcours guidé en 5 étapes : foyer, revenus, déjà fait, leviers, résultat.
- Comparaison avant/après en couleurs : rouge = avant, vert = après, orange = à vérifier.
- Module « Fructifier » : projection année par année de l'épargne (livrets, LEP, assurance-vie, PEA, PER, compte-titres), net d'impôts, avec répartition priorisée.
- 11 leviers simulés (PER, option barème, dons, emploi à domicile, garde, syndicat, pension, EHPAD, FCPI/FIP, IR-PME) et 30 leviers recensés dans l'onglet Audit.
- Chaque levier donne l'économie en €, le plafond restant, les étapes à cocher, la case de déclaration et un lien officiel.
- Aucune donnée envoyée : tout reste dans le navigateur (localStorage).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'entrée |
| `params.js` | **Barèmes, plafonds et catalogue d'audit : seul fichier à mettre à jour chaque année** |
| `calc.js` | Moteur de calcul (quotient familial plafonné, décote, réductions, crédits, plafond global) |
| `app.js` | Interface et parcours |
| `style.css` | Styles et code couleur |
| `tests/test.js` | Tests du calcul : `node tests/test.js` |

## Mise en ligne avec GitHub Pages

1. Copier ces fichiers dans un dépôt (ou un sous-dossier `impots/` d'un dépôt existant).
2. Settings → Pages → branche `main`, dossier racine.
3. Sur iPhone : ouvrir le lien dans Safari → Partager → « Sur l'écran d'accueil ».

## Mise à jour annuelle

Chaque automne, après le vote de la loi de finances, remplacer dans `params.js` les tranches, la décote, le plafond du quotient familial et les plafonds marqués « projet » ou « estimé ». Puis lancer `node tests/test.js`.

## Inspiration

Règles inspirées d'[OpenFisca-France](https://github.com/openfisca/openfisca-france), le moteur open source utilisé par l'administration. OpenFisca calcule l'impôt ; cette appli ajoute la recherche des leviers et le plan d'action.

## Avertissement

Simulation indicative. Ce n'est ni un conseil fiscal ni un conseil en investissement. Vérifier sur impots.gouv.fr avant d'agir.
