// Lancer : node tests/test.js
global.DATA = require("../params.js").DATA;
var F = require("../calc.js");
var fails = 0;
function eq(label, got, want, tol) {
  var ok = Math.abs(got - want) <= (tol || 1);
  if (!ok) fails++;
  console.log((ok ? "OK   " : "ECHEC"), label, "=>", Math.round(got * 100) / 100, "attendu", want);
}
var base = {annee: "2025", situation: "seul", enfants: 0, enfantsU6: 0, majeurs: 0, sal1: 0, sal2: 0, frais1: 0, autres: 0,
  divid: 0, interets: 0, per: 0, plafondPER: "", don75: 0, don66: 0, emploi: 0, garde: 0, syndic: 0, pension: 0, ehpad: 0, irpme: 0, fcpi: 0,
  col: 0, lyc: 0, sup: 0, ehpadNb: 0, optBareme: false};
function S(o) { return Object.assign({}, base, o); }

eq("2025, seul, 30 000 € imposables", F.compute(S({autres: 30000})).net, 2104);
eq("2026 (PLF), seul, 30 630 €", F.compute(S({annee: "2026", autres: 30630})).net, 2148);
eq("PER 3 000 € à 30 %", F.compute(S({annee: "2026", autres: 50000})).net - F.compute(S({annee: "2026", autres: 50000}), {per: 3000}).net, 900);
var g = S({annee: "2026", enfants: 1, enfantsU6: 1, autres: 50000});
eq("Garde 3 500 € => crédit 1 750 €", F.compute(g).net - F.compute(g, {garde: 3500}).net, 1750);
eq("Dons 2 000 € à 75 %", F.compute(S({annee: "2026", autres: 50000})).net - F.compute(S({annee: "2026", autres: 50000}), {don75: 2000}).net, 1500);
eq("Plafond global 10 000 € respecté", F.compute(S({annee: "2026", enfants: 3, autres: 90000}), {emploi: 15000, irpme: 100000}).credits +
   F.compute(S({annee: "2026", enfants: 3, autres: 90000}), {emploi: 15000, irpme: 100000}).reds, 10000);
eq("Scolarité : 1 collège + 1 lycée", F.compute(S({annee: "2026", autres: 50000, col: 1, lyc: 1})).scol, 214);
// Option barème : revenu faible, dividendes 1 000 € => barème moins cher que 12,8 %
var cap = S({annee: "2026", autres: 11000, divid: 1000});
var gain = F.compute(cap).net - F.compute(cap, {bareme: 1}).net;
console.log(gain > 0 ? "OK   " : "ECHEC", "Option barème avantageuse à faible revenu, gain =", Math.round(gain));
if (gain <= 0) fails++;
// Frais réels
var fr = F.compute(S({annee: "2026", sal1: 30000, frais1: 6000}));
console.log(fr.fraisReelsRetenus ? "OK   " : "ECHEC", "Frais réels retenus si > 10 %");
if (!fr.fraisReelsRetenus) fails++;
// Épargne
eq("AV fonds € 10 000 € à 2,6 % sur 8 ans, net", F.projeter("fe", {capital: 10000, ans: 8, taux: 0.026}).fin.net, 10000 + (10000 * Math.pow(1.026, 8) - 10000) * (1 - 0.172), 1);
eq("PEA 10 000 € à 7 % sur 10 ans, net (PS 18,6 %)", F.projeter("pea", {capital: 10000, ans: 10, taux: 0.07}).fin.net, 10000 + (10000 * Math.pow(1.07, 10) - 10000) * (1 - 0.186), 1);
eq("PEA retiré avant 5 ans : 31,4 %", F.projeter("pea", {capital: 10000, ans: 3, taux: 0.07}).fin.net, 10000 + (10000 * Math.pow(1.07, 3) - 10000) * (1 - 0.314), 1);
eq("Livret A 10 000 € à 1,7 % sur 5 ans", F.projeter("livretA", {capital: 10000, ans: 5, taux: 0.017}).fin.net, 10000 * Math.pow(1.017, 5), 1);
eq("Versements mensuels 100 € sur 1 an à 0 %", F.projeter("courant", {capital: 0, mensuel: 100, ans: 1, taux: 0}).fin.net, 1200, 0.01);
process.exit(fails ? 1 : 0);
