/* Moteur de calcul de l'impôt sur le revenu. Fonctions pures, testables sous Node. */
(function (root) {
  var D = root.DATA;

  function bareme(q, tranches) {
    var t = 0, prev = 0;
    for (var i = 0; i < tranches.length; i++) {
      var lim = tranches[i][0], r = tranches[i][1];
      if (q > prev) t += (Math.min(q, lim) - prev) * r;
      prev = lim;
    }
    return t;
  }

  function nbParts(S) {
    var base = S.situation === "couple" ? 2 : 1;
    var e = Math.max(0, Math.floor(+S.enfants || 0));
    return {base: base, parts: base + Math.min(e, 2) * 0.5 + Math.max(0, e - 2)};
  }

  /* Impôt d'un revenu imposable : quotient familial plafonné, puis décote. */
  function impotDe(rni, S, Y) {
    var p = nbParts(S), couple = S.situation === "couple";
    var withParts = bareme(rni / p.parts, Y.tranches) * p.parts;
    var withBase = bareme(rni / p.base, Y.tranches) * p.base;
    var maxAdv = Y.plafondQF * (p.parts - p.base) * 2;
    var imp = withParts;
    if (withBase - withParts > maxAdv) imp = withBase - maxAdv;
    var dBase = couple ? Y.decote.couple : Y.decote.seul;
    var decote = 0;
    if (imp < dBase / Y.decote.taux) decote = Math.max(0, dBase - Y.decote.taux * imp);
    return {brut: imp, decote: decote, net: Math.max(0, imp - decote), parts: p.parts};
  }

  function compute(S, ex) {
    ex = ex || {};
    var Y = D.years[S.annee], C = D.commun;
    var couple = S.situation === "couple";
    var adults = couple ? 2 : 1;
    var n = function (k) { return Math.max(0, +S[k] || 0) + Math.max(0, +ex[k] || 0); };
    var abat = function (s) { return s <= 0 ? 0 : Math.min(s, Math.min(Math.max(s * 0.10, Y.abatt.min), Y.abatt.max)); };

    var sal1 = Math.max(0, +S.sal1 || 0), sal2 = couple ? Math.max(0, +S.sal2 || 0) : 0;
    var a1 = abat(sal1), fr = Math.max(0, +S.frais1 || 0);
    var fraisReelsRetenus = fr > a1;
    var net1 = Math.max(0, sal1 - (fraisReelsRetenus ? fr : a1));
    var net2 = Math.max(0, sal2 - abat(sal2));

    // PER
    var est = [net1, net2].slice(0, adults).reduce(function (s, x) { return s + Math.min(Math.max(x * 0.10, Y.per.min), Y.per.max); }, 0);
    var plafondPER = (+S.plafondPER > 0) ? +S.plafondPER : est;
    var perDed = Math.min(n("per"), plafondPER);
    var perRem = Math.max(0, plafondPER - (+S.per || 0));

    // Pension à un enfant majeur
    var majeurs = Math.max(0, Math.floor(+S.majeurs || 0));
    var pensCap = majeurs * Y.pensionMajeur;
    var pensDed = Math.min(n("pension"), pensCap);

    var autres = Math.max(0, +S.autres || 0);
    var rni = Math.max(0, net1 + net2 + autres - perDed - pensDed);

    // Revenus de capitaux : PFU (12,8 % d'IR) ou option barème
    var div = Math.max(0, +S.divid || 0), inter = Math.max(0, +S.interets || 0);
    var capBrut = div + inter;
    var capImposable = div * (1 - C.capital.abattDividendes) + inter;
    var optB = !!ex.bareme || !!S.optBareme;
    var pfu = 0, imp;
    if (capBrut > 0 && optB) {
      imp = impotDe(rni + capImposable, S, Y);
    } else {
      imp = impotDe(rni, S, Y);
      pfu = capBrut * C.capital.pfuIR;
    }
    var baremeCapital = capBrut > 0 ? (impotDe(rni + capImposable, S, Y).net - impotDe(rni, S, Y).net) : 0;

    var p = nbParts(S);
    var q = (rni + (optB ? capImposable : 0)) / p.parts, tmi = 0, prev = 0;
    for (var i = 0; i < Y.tranches.length; i++) { if (q > prev) tmi = Y.tranches[i][1]; prev = Y.tranches[i][0]; }

    // Réductions hors plafond global : dons et scolarité
    var d75 = n("don75"), d66 = n("don66");
    var in75 = Math.min(d75, Y.don75);
    var rest66 = Math.max(0, d75 - Y.don75) + d66;
    var lim66 = Math.max(0, C.dons.limiteRevenu * rni - in75);
    var donsRed = in75 * C.dons.taux75 + Math.min(rest66, lim66) * C.dons.taux66;
    var scol = Math.max(0, +S.col || 0) * C.scolarite.col + Math.max(0, +S.lyc || 0) * C.scolarite.lyc + Math.max(0, +S.sup || 0) * C.scolarite.sup;

    // Avantages sous plafond global
    var enfants = Math.max(0, Math.floor(+S.enfants || 0));
    var u6 = Math.min(enfants, Math.max(0, Math.floor(+S.enfantsU6 || 0)));
    var ehNb = Math.max(0, Math.floor(+S.ehpadNb || 0));
    var emploiCap = Math.min(C.emploi.max, C.emploi.base + C.emploi.parEnfant * enfants);
    var gardeCap = C.garde.parEnfant * u6;
    var syndCap = C.syndic.limiteSalaires * (sal1 + sal2);
    var ehpadCap = C.ehpad.plafond * ehNb;
    var irpmeCap = couple ? C.irpme.plafondCouple : C.irpme.plafondSeul;
    var fcpiCap = couple ? C.fcpi.plafondCouple : C.fcpi.plafondSeul;

    var credits = Math.min(n("emploi"), emploiCap) * C.emploi.taux
                + Math.min(n("garde"), gardeCap) * C.garde.taux
                + Math.min(n("syndic"), syndCap) * C.syndic.taux;
    var reds = Math.min(n("ehpad"), ehpadCap) * C.ehpad.taux
             + Math.min(n("irpme"), irpmeCap) * C.irpme.taux
             + Math.min(n("fcpi"), fcpiCap) * C.fcpi.taux;
    var room = C.plafondGlobal;
    credits = Math.min(credits, room); room -= credits;
    reds = Math.min(reds, room);

    var apresReductions = Math.max(0, imp.net - donsRed - scol - reds);
    var net = apresReductions - credits + pfu;

    return {
      rni: rni, parts: p.parts, tmi: tmi, brut: imp.brut, decote: imp.decote, impBareme: imp.net,
      pfu: pfu, donsRed: donsRed, scol: scol, reds: reds, credits: credits, net: net,
      redApplied: imp.net - apresReductions,
      plafondPER: plafondPER, perRem: perRem, pensCap: pensCap, majeurs: majeurs,
      emploiCap: emploiCap, gardeCap: gardeCap, syndCap: syndCap, ehpadCap: ehpadCap, irpmeCap: irpmeCap, fcpiCap: fcpiCap,
      u6: u6, enfants: enfants, capBrut: capBrut, baremeCapital: baremeCapital, optB: optB,
      fraisReelsRetenus: fraisReelsRetenus, a1: a1, sal1: sal1, sal2: sal2, couple: couple
    };
  }

  /* ---------- Épargne : projection et fiscalité à la sortie ---------- */
  var ENV = {
    courant: {nom: "Compte courant", court: "Compte courant"},
    livretA: {nom: "Livret A / LDDS", court: "Livret A"},
    lep: {nom: "LEP", court: "LEP"},
    fe: {nom: "Assurance-vie fonds euros", court: "AV fonds €"},
    uc: {nom: "Assurance-vie unités de compte", court: "AV UC"},
    pea: {nom: "PEA (ETF actions)", court: "PEA"},
    per: {nom: "PER", court: "PER"},
    cto: {nom: "Compte-titres", court: "CTO"}
  };

  function tauxEnv(env, profil, hyp) {
    var E = D.epargne, p = E.profils[profil] || E.profils.equilibre; hyp = hyp || {};
    if (hyp[env] != null && hyp[env] !== "") return +hyp[env];
    return {courant: 0, livretA: E.livretA.taux, lep: E.lep.taux, fe: E.fondsEuros.taux, uc: p.uc, pea: p.actions, per: p.uc, cto: p.actions}[env];
  }

  /* Valeur nette si l'on retire tout au bout de `ans` années.
     ageDeja = ancienneté du contrat avant aujourd'hui. tmi = tranche actuelle (déduction PER), tmiSortie = tranche à la retraite. */
  function netSortie(env, brut, verse, agTotal, o) {
    var f = D.epargne.fisc, g = Math.max(0, brut - verse);
    switch (env) {
      case "courant": case "livretA": case "lep": return brut;
      case "cto": return brut - g * (f.pfuIR + f.psAutres);
      case "pea": return agTotal >= f.peaAns ? brut - g * f.psAutres : brut - g * (f.pfuIR + f.psAutres);
      case "fe": case "uc":
        var ab = o.couple ? f.avAbattCouple : f.avAbattSeul;
        var ir = agTotal >= f.avAns ? Math.max(0, g - ab) * f.avIR8 : g * f.pfuIR;
        return brut - ir - g * f.psAV;
      case "per":
        var entree = verse * (o.tmi || 0);
        return brut - verse * (o.tmiSortie != null ? o.tmiSortie : o.tmi || 0) - g * (f.pfuIR + f.psAutres) + entree;
    }
    return brut;
  }

  function projeter(env, o) {
    var r = o.taux != null ? o.taux : tauxEnv(env, o.profil, o.hyp);
    var val = Math.max(0, +o.capital || 0), verse = val, men = Math.max(0, +o.mensuel || 0), out = [];
    out.push({an: 0, brut: val, verse: verse, net: netSortie(env, val, verse, o.ageDeja || 0, o)});
    for (var a = 1; a <= o.ans; a++) {
      val = val * (1 + r) + men * 12 * (1 + r / 2);
      verse += men * 12;
      out.push({an: a, brut: val, verse: verse, net: netSortie(env, val, verse, (o.ageDeja || 0) + a, o)});
    }
    return {env: env, taux: r, serie: out, fin: out[out.length - 1]};
  }

  root.Fisc = {compute: compute, impotDe: impotDe, bareme: bareme, nbParts: nbParts, projeter: projeter, netSortie: netSortie, tauxEnv: tauxEnv, ENV: ENV};
  if (typeof module !== "undefined") module.exports = root.Fisc;
})(typeof window !== "undefined" ? window : globalThis);
