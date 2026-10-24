/* Interface : parcours guidé en 5 étapes, audit des leviers, barèmes. Données stockées dans le navigateur uniquement. */
(function () {
  var F = window.Fisc, D = window.DATA, A = window.AUDIT;
  var KEY = "optimiseur-impots-v2";
  var eur = function (n) { return new Intl.NumberFormat("fr-FR", {style: "currency", currency: "EUR", maximumFractionDigits: 0}).format(Math.round(n || 0)); };
  var pct = function (n) { return (Math.round(n * 1000) / 10).toLocaleString("fr-FR") + " %"; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); };

  var DEFAULTS = {annee: "2026", situation: "seul", enfants: 0, enfantsU6: 0, majeurs: 0, col: 0, lyc: 0, sup: 0,
    sal1: 0, sal2: 0, frais1: 0, autres: 0, divid: 0, interets: 0,
    per: 0, plafondPER: "", don75: 0, don66: 0, emploi: 0, garde: 0, syndic: 0, pension: 0, ehpad: 0, ehpadNb: 0, irpme: 0, fcpi: 0,
    optBareme: false, plan: {}, todo: {}, exemple: false, step: 0, tab: "p", fam: "Tous",
    epCourant: 0, epLivret: 0, depensesMois: 0, moisPrecaution: 3, epMensuel: 0,
    peaOuvert: "non", peaAnnee: 0, peaVerse: 0, avOuvert: "non", avAnnee: 0, avMontant: 0,
    horizon: 10, profil: "equilibre", retraite: "non", hyp: {}};
  var NOW_Y = new Date().getFullYear();
  var S = clone(DEFAULTS);
  try { var raw = localStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); if (o && typeof o === "object") S = Object.assign(clone(DEFAULTS), o, {plan: o.plan || {}, todo: o.todo || {}}); } } catch (e) {}
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var SP = "https://www.service-public.fr/particuliers/recherche?keyword=";

  /* ---------- Leviers simulés ---------- */
  var LEVERS = [
    {id: "per", nom: "Verser sur un PER", type: "Déduction", nature: "Épargne conservée", natCls: "good", case: "6NS",
     room: function (c) { return c.perRem; }, ref: function (c) { return c.perRem; },
     desc: "Chaque euro versé baisse votre revenu imposable : l'économie est égale à votre tranche marginale. L'argent reste à vous, mais bloqué jusqu'à la retraite.",
     pas: ["Relevez votre plafond sur l'avis d'impôt, ligne « plafond épargne retraite ».", "Comparez 2 ou 3 PER (frais sur versement, frais de gestion, choix des supports).", "Ouvrez le PER et versez avant le 31 décembre.", "Déclarez le montant en case 6NS au printemps.", "Option : ajustez votre taux de prélèvement à la source sur impots.gouv.fr pour en profiter tout de suite."],
     url: SP + "plan+epargne+retraite", risque: "Capital bloqué jusqu'à la retraite, sortie imposée", warnIf: function (c) { return c.tmi <= 0.11 ? "Avec une tranche à " + pct(c.tmi) + ", le PER rapporte peu à l'entrée et la sortie sera imposée. Comparez avec une assurance-vie." : ""; }},
    {id: "bareme", toggle: true, nom: "Choisir le barème pour vos dividendes et intérêts", type: "Option", nature: "Gratuit", natCls: "good", case: "2OP",
     room: function () { return 0; }, ref: function () { return 1; },
     desc: "Par défaut, dividendes et intérêts sont taxés à 12,8 % d'impôt. Si votre tranche est à 0 % ou 11 %, le barème (avec abattement de 40 % sur les dividendes) coûte souvent moins.",
     pas: ["Vérifiez vos dividendes et intérêts sur l'IFU envoyé par votre banque.", "Cochez la case 2OP lors de la déclaration.", "L'option s'applique à tous vos revenus de capitaux de l'année."],
     url: SP + "option+bareme+progressif+revenus+capitaux", risque: "S'applique à tous les revenus de capitaux de l'année"},
    {id: "don75", nom: "Donner aux associations d'aide aux personnes en difficulté", type: "Réduction 75 %", nature: "Dépense", natCls: "warn", case: "7UD",
     room: function (c, S) { return Math.max(0, D.years[S.annee].don75 - (+S.don75 || 0)); }, ref: function (c, S) { return Math.max(0, D.years[S.annee].don75 - (+S.don75 || 0)); },
     desc: "75 % du don revient en réduction d'impôt jusqu'au plafond. Un don de 100 € vous coûte 25 €.",
     pas: ["Choisissez un organisme éligible (aide alimentaire, logement, soins gratuits).", "Faites le don avant le 31 décembre et gardez le reçu fiscal.", "Déclarez le total en case 7UD."],
     url: SP + "dons+associations+reduction+impot", risque: "Dépense définitive"},
    {id: "don66", nom: "Donner à d'autres organismes d'intérêt général", type: "Réduction 66 %", nature: "Dépense", natCls: "warn", case: "7UF",
     room: function (c, S) { return Math.max(0, D.commun.dons.limiteRevenu * c.rni - (+S.don66 || 0) - Math.min(+S.don75 || 0, D.years[S.annee].don75)); },
     ref: function (c, S) { return Math.min(1000, Math.max(0, D.commun.dons.limiteRevenu * c.rni - (+S.don66 || 0))); },
     desc: "66 % du don revient en réduction, dans la limite de 20 % du revenu imposable. L'excédent se reporte sur 5 ans.",
     pas: ["Vérifiez que l'organisme délivre des reçus fiscaux.", "Donnez avant le 31 décembre.", "Déclarez le total en case 7UF."],
     url: SP + "dons+organismes+interet+general", risque: "Dépense définitive"},
    {id: "emploi", nom: "Emploi d'un salarié à domicile", type: "Crédit 50 %", nature: "Dépense", natCls: "warn", case: "7DB",
     room: function (c, S) { return Math.max(0, c.emploiCap - (+S.emploi || 0)); }, ref: function (c, S) { return Math.max(0, c.emploiCap - (+S.emploi || 0)); },
     desc: "Ménage, jardinage, petit bricolage, soutien scolaire : 50 % remboursé, même sans impôt à payer. Intéressant pour une dépense que vous auriez faite de toute façon.",
     pas: ["Passez par le Cesu, Pajemploi ou un organisme agréé.", "Activez l'avance immédiate du crédit si l'organisme la propose.", "Gardez l'attestation fiscale annuelle.", "Déclarez en case 7DB, avec l'identité de l'employé ou de l'organisme."],
     url: SP + "emploi+salarie+domicile+credit+impot", risque: "Dépense réelle nécessaire"},
    {id: "garde", nom: "Garde d'enfant de moins de 6 ans hors domicile", type: "Crédit 50 %", nature: "Dépense", natCls: "warn", case: "7GA",
     room: function (c, S) { return Math.max(0, c.gardeCap - (+S.garde || 0)); }, ref: function (c, S) { return Math.max(0, c.gardeCap - (+S.garde || 0)); },
     desc: "Crèche, assistante maternelle agréée, garderie : 50 % des frais (après aides CAF), jusqu'à 3 500 € par enfant.",
     pas: ["Déduisez les aides CAF (CMG) des frais déclarés.", "Demandez l'attestation annuelle à la crèche ou l'assistante maternelle.", "Déclarez en case 7GA (7GB, 7GC pour les suivants)."],
     url: SP + "frais+garde+enfant+credit+impot", risque: "Dépense réelle nécessaire"},
    {id: "syndic", nom: "Cotisations syndicales", type: "Crédit 66 %", nature: "Dépense", natCls: "warn", case: "7AC",
     room: function (c, S) { return Math.max(0, c.syndCap - (+S.syndic || 0)); }, ref: function (c, S) { return Math.max(0, c.syndCap - (+S.syndic || 0)); },
     desc: "66 % des cotisations remboursés, même sans impôt, dans la limite de 1 % du salaire.",
     pas: ["Demandez l'attestation de cotisation à votre syndicat.", "Déclarez en case 7AC (sauf si vous êtes aux frais réels)."],
     url: SP + "cotisations+syndicales+credit+impot", risque: "Incompatible avec les frais réels"},
    {id: "pension", nom: "Aider un enfant majeur", type: "Déduction", nature: "Dépense", natCls: "warn", case: "6EL",
     room: function (c, S) { return Math.max(0, c.pensCap - (+S.pension || 0)); }, ref: function (c, S) { return Math.max(0, c.pensCap - (+S.pension || 0)); },
     desc: "La pension versée à un enfant majeur non rattaché est déductible jusqu'au plafond par enfant. Comparez avec le rattachement (demi-part) : l'appli calcule la version pension.",
     pas: ["Indiquez le nombre d'enfants majeurs aidés à l'étape Foyer.", "Gardez les preuves des versements (virements, loyers payés).", "Déclarez en case 6EL. L'enfant déclare la même somme en revenu."],
     url: SP + "pension+alimentaire+enfant+majeur", risque: "L'enfant déclare la pension en revenu"},
    {id: "ehpad", nom: "Hébergement en EHPAD d'un proche", type: "Réduction 25 %", nature: "Dépense", natCls: "warn", case: "7CD",
     room: function (c, S) { return Math.max(0, c.ehpadCap - (+S.ehpad || 0)); }, ref: function (c, S) { return Math.max(0, c.ehpadCap - (+S.ehpad || 0)); },
     desc: "25 % des frais de dépendance et d'hébergement, jusqu'à 10 000 € par personne hébergée.",
     pas: ["Indiquez le nombre de personnes hébergées à l'étape Déjà fait.", "Demandez l'attestation annuelle de l'établissement.", "Déclarez en case 7CD."],
     url: SP + "reduction+impot+ehpad", risque: "Dépense réelle nécessaire"},
    {id: "fcpi", nom: "FCPI / FIP (fonds de PME)", type: "Réduction 25 %", nature: "Placement risqué", natCls: "bad", case: "7GQ",
     room: function (c) { return c.fcpiCap; }, ref: function () { return 2000; },
     desc: "Réduction sur le montant investi dans des fonds de PME non cotées. Taux à confirmer chaque année. Risque de perte et blocage d'au moins 5 ans.",
     pas: ["Vérifiez le taux de réduction en vigueur sur le document du fonds.", "Lisez les frais (souvent élevés) et la durée de blocage.", "Souscrivez avant le 31 décembre.", "Déclarez en case 7GQ (FCPI) ou 7FQ (FIP)."],
     url: SP + "FCPI+FIP+reduction+impot", risque: "Perte en capital possible, blocage 5 ans et plus"},
    {id: "irpme", nom: "Investir au capital de PME (IR-PME)", type: "Réduction 18 %", nature: "Placement risqué", natCls: "bad", case: "7CF",
     room: function (c) { return c.irpmeCap; }, ref: function () { return 2000; },
     desc: "18 % du montant investi au capital d'une PME non cotée. À réserver à un vrai projet d'investissement.",
     pas: ["Choisissez l'entreprise ou la plateforme, vérifiez son éligibilité.", "Conservez les titres 5 ans.", "Déclarez en case 7CF avec l'attestation de souscription."],
     url: SP + "reduction+impot+souscription+capital+PME", risque: "Perte en capital possible"}
  ];

  /* ---------- Questions par étape ---------- */
  var STEPS = [
    {t: "Bienvenue"},
    {t: "Foyer", q: [
      {k: "annee", type: "choice", l: "Pour quelle année ?", opts: [["2026", "Revenus 2026", "Impôt payé en 2027. Leviers possibles jusqu'au 31 décembre 2026."], ["2025", "Revenus 2025", "Impôt payé en 2026, barème voté. Pour vérifier votre avis."]]},
      {k: "situation", type: "choice", l: "Votre situation", opts: [["seul", "Seul", "Célibataire, divorcé, veuf"], ["couple", "En couple", "Marié ou pacsé"]]},
      {row: [{k: "enfants", l: "Enfants à charge"}, {k: "enfantsU6", l: "dont moins de 6 ans"}]},
      {row3: [{k: "col", l: "Au collège"}, {k: "lyc", l: "Au lycée"}, {k: "sup", l: "Études sup."}], h: "Pour la réduction scolarité, calculée automatiquement."},
      {k: "majeurs", l: "Enfants majeurs que vous aidez", h: "Non rattachés à votre foyer"}
    ]},
    {t: "Revenus", q: [
      {k: "sal1", l: "Votre salaire net imposable annuel", c: "1AJ", h: "Bulletin de décembre, ligne « net imposable » cumulé"},
      {k: "sal2", l: "Salaire net imposable du conjoint", c: "1BJ", only: "couple"},
      {k: "frais1", l: "Vos frais réels estimés", c: "1AK", h: "Kilomètres (barème kilométrique), repas, formation. Retenus seulement s'ils dépassent 10 %"},
      {k: "autres", l: "Autres revenus nets imposables", h: "Pensions, revenus fonciers nets, etc."},
      {row: [{k: "divid", l: "Dividendes bruts", c: "2DC"}, {k: "interets", l: "Intérêts imposables", c: "2TR"}], h: "Hors PEA, livret A et assurance-vie. Voir l'IFU de votre banque."}
    ]},
    {t: "Déjà fait", q: [
      {k: "per", l: "Versé sur un PER cette année", c: "6NS"},
      {k: "plafondPER", l: "Votre plafond épargne retraite", c: "avis", h: "Sur l'avis d'impôt. Vide : estimation automatique"},
      {row: [{k: "don75", l: "Dons aide aux démunis", c: "7UD"}, {k: "don66", l: "Autres dons", c: "7UF"}]},
      {row: [{k: "emploi", l: "Emploi à domicile", c: "7DB"}, {k: "garde", l: "Garde hors domicile", c: "7GA"}]},
      {row: [{k: "syndic", l: "Cotisations syndicales", c: "7AC"}, {k: "pension", l: "Pension enfant majeur", c: "6EL"}]},
      {row: [{k: "ehpad", l: "Frais d'EHPAD", c: "7CD"}, {k: "ehpadNb", l: "Personnes en EHPAD"}]},
      {row: [{k: "fcpi", l: "FCPI / FIP", c: "7GQ"}, {k: "irpme", l: "IR-PME", c: "7CF"}]}
    ]},
    {t: "Épargne", q: [
      {row: [{k: "epCourant", l: "Argent qui dort sur le compte courant"}, {k: "epLivret", l: "Total sur vos livrets"}], h: "Livret A, LDDS, livrets bancaires. C'est l'argent que l'on peut faire travailler."},
      {row: [{k: "depensesMois", l: "Dépenses par mois du foyer"}, {k: "moisPrecaution", l: "Mois à garder de côté"}], h: "Épargne de précaution : 3 à 6 mois de dépenses, toujours disponibles."},
      {k: "epMensuel", l: "Vous pouvez épargner chaque mois", h: "Montant que vous pouvez verser tous les mois, en €"},
      {k: "peaOuvert", type: "choice", l: "Avez-vous un PEA ?", opts: [["oui", "Oui", "Déjà ouvert"], ["non", "Non", "Pas encore"]]},
      {row: [{k: "peaAnnee", l: "Année d'ouverture du PEA"}, {k: "peaVerse", l: "Déjà versé sur le PEA"}], only: "peaOuvert=oui", h: "Après 5 ans, les gains ne paient plus d'impôt, seulement 18,6 % de prélèvements sociaux."},
      {k: "avOuvert", type: "choice", l: "Avez-vous une assurance-vie ?", opts: [["oui", "Oui", "Déjà ouverte"], ["non", "Non", "Pas encore"]]},
      {row: [{k: "avAnnee", l: "Année d'ouverture"}, {k: "avMontant", l: "Montant actuel"}], only: "avOuvert=oui", h: "Après 8 ans, 4 600 € de gains par an sans impôt (9 200 € en couple)."},
      {k: "horizon", l: "Dans combien d'années aurez-vous besoin de cet argent ?", h: "En années. Moins de 3 ans : on reste prudent."},
      {k: "profil", type: "choice", l: "Face aux variations de la bourse", opts: [["prudent", "Prudent", "Je ne veux pas voir mon capital baisser"], ["equilibre", "Équilibré", "J'accepte des baisses temporaires"], ["dynamique", "Dynamique", "Je vise le rendement sur le long terme"]]},
      {k: "retraite", type: "choice", l: "Une partie est pour la retraite ?", opts: [["oui", "Oui", "Argent bloqué acceptable jusqu'à la retraite"], ["non", "Non", "Je veux pouvoir le récupérer"]]}
    ]},
    {t: "Leviers"},
    {t: "Résultat"}
  ];

  var app = document.getElementById("app");

  function planEx() {
    var ex = {};
    LEVERS.forEach(function (L) { if (L.toggle) { if (S.plan[L.id]) ex[L.id] = 1; } else { var v = +S.plan[L.id] || 0; if (v > 0) ex[L.id] = v; } });
    return ex;
  }
  function stats(L, c0) {
    if (L.toggle) {
      if (c0.capBrut <= 0 || S.optBareme) return {room: 0, ref: 0, gMax: 0, g1000: 0};
      var g = c0.net - F.compute(S, {bareme: 1}).net;
      return {room: 0, ref: 0, gMax: Math.max(0, g), g1000: 0};
    }
    var room = Math.max(0, L.room(c0, S)), ref = Math.max(0, Math.min(L.ref(c0, S), room || L.ref(c0, S)));
    var o = {}; o[L.id] = ref;
    var gMax = ref > 0 ? c0.net - F.compute(S, o).net : 0;
    var a = Math.min(1000, ref), o2 = {}; o2[L.id] = a;
    var g1000 = a > 0 ? (c0.net - F.compute(S, o2).net) * 1000 / a : 0;
    return {room: room, ref: ref, gMax: gMax, g1000: g1000};
  }
  function gainOf(L, c0) {
    var o = {};
    if (L.toggle) { if (!S.plan[L.id]) return 0; o.bareme = 1; }
    else { var v = +S.plan[L.id] || 0; if (v <= 0) return 0; o[L.id] = v; }
    return c0.net - F.compute(S, o).net;
  }
  function fmtTax(n) { return n < 0 ? "+" + eur(-n) + " remb." : eur(n); }

  /* ---------- En-tête : avant / après toujours visible ---------- */
  function head() {
    var c0 = F.compute(S), c1 = F.compute(S, planEx()), g = c0.net - c1.net;
    return '<header class="top"><h1>Optimiseur d\'impôts</h1><span class="tag info">' + esc(D.years[S.annee].label.split(" (")[0]) + '</span></header>' +
      '<div class="ba" aria-live="polite"><div class="side before"><span class="k">Avant optimisation</span><span class="v">' + fmtTax(c0.net) + '</span></div>' +
      '<div class="arrow" aria-hidden="true">→</div>' +
      '<div class="side after"><span class="k">Après optimisation</span><span class="v">' + fmtTax(c1.net) + '</span></div>' +
      '<div class="delta"><span>Économie : <b>' + eur(g) + '</b>' + (c0.net > 0 && g > 0 ? ' <span class="muted">(−' + pct(g / c0.net) + ')</span>' : '') + '</span><span class="muted num">TMI ' + pct(c0.tmi) + ' · ' + c0.parts.toLocaleString("fr-FR") + ' parts</span></div></div>' +
      '<nav class="tabs" role="tablist" aria-label="Sections">' +
      tabBtn("p", "Parcours") + tabBtn("f", "Fructifier") + tabBtn("a", "Audit") + tabBtn("b", "Barèmes") + '</nav>';
  }
  function tabBtn(id, l) { return '<button type="button" role="tab" data-tab="' + id + '" aria-selected="' + (S.tab === id) + '">' + l + '</button>'; }

  /* ---------- Parcours ---------- */
  function progress() {
    var n = STEPS.length - 1;
    return '<div class="prog" aria-hidden="true"><i style="width:' + Math.round(S.step / n * 100) + '%"></i></div>' +
      '<div class="steps"><span>Étape ' + S.step + ' sur ' + n + '</span><span>' + esc(STEPS[S.step].t) + '</span></div>';
  }
  function navBtns(nextLabel) {
    return '<div class="nav">' + (S.step > 0 ? '<button type="button" class="btn ghost" data-go="-1">Retour</button>' : '') +
      (S.step < STEPS.length - 1 ? '<button type="button" class="btn primary" data-go="1">' + (nextLabel || "Continuer") + '</button>' : '') + '</div>';
  }
  function shown(only) {
    if (!only) return true;
    if (only.indexOf("=") > 0) { var p = only.split("="); return S[p[0]] === p[1]; }
    return S.situation === only;
  }
  function input(d) {
    var id = "f_" + d.k, v = S[d.k];
    return '<div class="fld"' + (shown(d.only) ? '' : ' hidden') + '>' +
      '<label for="' + id + '"><span>' + esc(d.l) + '</span>' + (d.c ? '<span class="case">' + d.c + '</span>' : '') + '</label>' +
      '<input id="' + id + '" data-k="' + d.k + '" type="number" inputmode="decimal" min="0" step="any" value="' + (v === "" || v === 0 ? "" : v) + '" placeholder="0">' +
      (d.h ? '<span class="hint">' + esc(d.h) + '</span>' : '') + '</div>';
  }
  function question(d) {
    if (d.row && !shown(d.only)) return "";
    if (d.row) return '<div class="row2">' + d.row.map(input).join("") + '</div>' + (d.h ? '<span class="hint">' + esc(d.h) + '</span>' : '');
    if (d.row3) return '<div class="row3">' + d.row3.map(input).join("") + '</div>' + (d.h ? '<span class="hint">' + esc(d.h) + '</span>' : '');
    if (d.type === "choice") return '<div class="fld"><span style="font-weight:500;font-size:14px">' + esc(d.l) + '</span><div class="opts">' +
      d.opts.map(function (o) { return '<button type="button" class="opt" data-choice="' + d.k + '" data-val="' + o[0] + '" aria-pressed="' + (S[d.k] === o[0]) + '">' + esc(o[1]) + '<small>' + esc(o[2]) + '</small></button>'; }).join("") + '</div></div>';
    return input(d);
  }

  function stepWelcome() {
    var days = Math.ceil((new Date(D.dateLimite["2026"] + "T23:59:59") - new Date()) / 86400000);
    return '<section class="card hero">' + progress() +
      '<h2>Payez le juste impôt, pas plus</h2>' +
      '<p class="muted">Cinq étapes courtes. L\'appli calcule votre impôt, classe les leviers légaux par économie et vous donne les démarches, case par case.</p>' +
      '<ul class="small"><li>Environ 3 minutes avec votre dernier avis d\'impôt et votre bulletin de décembre.</li><li>Vos données restent sur ce téléphone. Rien n\'est envoyé.</li>' +
      (days > 0 ? '<li><b>Il reste ' + days + ' jours</b> pour agir sur vos revenus 2026 (jusqu\'au 31 décembre).</li>' : '') + '</ul>' +
      '<div class="legend"><span class="tag bad">Rouge : avant</span><span class="tag good">Vert : après</span><span class="tag warn">Orange : à vérifier</span></div>' +
      (S.exemple ? '<p class="notice">Les montants affichés sont des exemples. Remplacez-les ou <button type="button" class="btn small ghost" data-clear="1" style="padding:2px 8px">videz tout</button>.</p>' : '') +
      navBtns("Commencer") + '<button type="button" class="btn ghost small" data-clear="1">Effacer mes données</button></section>';
  }
  function stepForm(st) {
    return '<section class="card">' + progress() + '<h2>' + esc(st.t) + '</h2>' + st.q.map(question).join("") + navBtns() + '</section>';
  }

  function leverCard(L, st, rank, c0) {
    var dis = st.gMax <= 0.5 && !(L.toggle && S.plan[L.id]);
    var warn = L.warnIf ? L.warnIf(c0) : "";
    var g = gainOf(L, c0);
    var ctrl;
    if (L.toggle) {
      ctrl = '<label class="sw"><input type="checkbox" data-toggle="' + L.id + '"' + (S.plan[L.id] ? " checked" : "") + '><span><b>Activer l\'option barème</b><span class="hint">Économie calculée : ' + eur(st.gMax) + '</span></span></label>';
    } else {
      ctrl = '<div class="mine"><div class="fld"><label for="p_' + L.id + '"><span>Montant à engager avant le 31/12</span>' +
        (st.ref > 0 ? '<button type="button" class="btn small ghost" data-fill="' + L.id + '" data-v="' + Math.round(st.ref) + '">Mettre ' + eur(st.ref) + '</button>' : '') + '</label>' +
        '<input id="p_' + L.id + '" data-plan="' + L.id + '" type="number" inputmode="decimal" min="0" step="any" value="' + (S.plan[L.id] || "") + '" placeholder="0"></div></div>';
    }
    var todo = L.pas.map(function (p, i) { var k = L.id + i, on = !!S.todo[k]; return '<li class="' + (on ? "done" : "") + '"><input type="checkbox" id="t_' + k + '" data-todo="' + k + '"' + (on ? " checked" : "") + '><label for="t_' + k + '"><span>' + esc(p) + '</span></label></li>'; }).join("");
    return '<article class="card lv' + (dis ? " off" : "") + '"><header><div><span class="eyebrow">' + (dis ? "Non applicable" : "N° " + rank) + ' · case ' + L.case + '</span><h3>' + esc(L.nom) + '</h3></div>' +
      '<div class="tags"><span class="tag info">' + esc(L.type) + '</span><span class="tag ' + L.natCls + '">' + esc(L.nature) + '</span></div></header>' +
      (L.toggle ? '' : '<div class="figs"><div class="g"><span class="k">Économie max (' + eur(st.ref) + ')</span><b>' + eur(st.gMax) + '</b></div><div><span class="k">Plafond restant</span><b>' + eur(st.room) + '</b></div><div><span class="k">' + (L.nature === "Dépense" ? "Coût réel de 1 000 €" : "Économie pour 1 000 €") + '</span><b>' + eur(L.nature === "Dépense" ? 1000 - st.g1000 : st.g1000) + '</b></div></div>') +
      '<p class="small muted">' + esc(L.desc) + '</p>' + (warn ? '<p class="notice">' + esc(warn) + '</p>' : '') +
      (dis ? '' : ctrl + '<div class="res' + (g > 0 ? '' : ' off') + '"><span>Votre économie</span><b>' + eur(g) + '</b></div>') +
      '<details><summary>Étapes à suivre et lien officiel</summary><ul class="todo">' + todo + '</ul><p class="hint">Point d\'attention : ' + esc(L.risque) + '.</p><a href="' + L.url + '" target="_blank" rel="noopener">Fiche officielle sur service-public.fr</a></details></article>';
  }
  function stepLevers() {
    var c0 = F.compute(S);
    var items = LEVERS.map(function (L) { return {L: L, st: stats(L, c0)}; });
    /* Ordre conseillé : gratuit, puis épargne conservée, puis dépenses (les plus rentables d'abord), puis placements risqués */
    var ORDER = {"Gratuit": 0, "Épargne conservée": 1, "Dépense": 2, "Placement risqué": 3};
    var on = items.filter(function (x) { return x.st.gMax > 0.5 || (x.L.toggle && S.plan[x.L.id]); }).sort(function (a, b) {
      return (ORDER[a.L.nature] - ORDER[b.L.nature]) || (a.L.nature === "Dépense" ? b.st.g1000 - a.st.g1000 : 0) || (b.st.gMax - a.st.gMax); });
    var off = items.filter(function (x) { return on.indexOf(x) < 0; });
    var h = '<section class="card">' + progress() + '<h2>Vos leviers, dans l\'ordre conseillé</h2>' +
      '<p class="small muted">Classés dans l\'ordre conseillé : d\'abord ce qui est gratuit, puis l\'épargne que vous gardez, puis les dépenses utiles, et enfin les placements à risque (en rouge). Entrez le montant que vous êtes prêt à engager : le bandeau du haut se met à jour.</p>' +
      (c0.net <= 0 ? '<p class="notice">Votre impôt est déjà nul : seuls les crédits d\'impôt (emploi à domicile, garde, syndicat) peuvent encore vous rapporter de l\'argent.</p>' : '') + '</section>';
    h += on.map(function (x, i) { return leverCard(x.L, x.st, i + 1, c0); }).join("");
    h += '<section class="card"><span class="eyebrow">Épargne</span><h3>Assurance-vie et PEA</h3><p class="small muted">Ils ne baissent pas l\'impôt de cette année, mais ils suppriment presque tout l\'impôt sur vos gains futurs : PEA après 5 ans, assurance-vie après 8 ans. Ouvrir tôt lance le compteur, même avec un petit versement.</p>' +
      '<button type="button" class="btn" data-tab="f">Voir combien votre épargne peut rapporter</button></section>';
    if (off.length) h += '<p class="eyebrow">Non applicables à votre situation</p>' + off.map(function (x) { return leverCard(x.L, x.st, 0, c0); }).join("");
    h += '<section class="card">' + navBtns("Voir le résultat") + '</section>';
    return h;
  }

  function stepResult() {
    var c0 = F.compute(S), ex = planEx(), c1 = F.compute(S, ex), g = c0.net - c1.net;
    var rows = [
      ["Revenu imposable", c0.rni, c1.rni, "less"],
      ["Impôt au barème (après décote)", c0.impBareme, c1.impBareme, "less"],
      ["Réductions d'impôt", c0.redApplied, c1.redApplied, "more"],
      ["Crédits d'impôt", c0.credits, c1.credits, "more"],
      ["Impôt sur les capitaux (12,8 %)", c0.pfu, c1.pfu, "less"]
    ].filter(function (r) { return r[1] || r[2]; });
    var tr = rows.map(function (r) { var d = r[2] - r[1], good = r[3] === "less" ? d < 0 : d > 0; return '<tr><td>' + r[0] + '</td><td class="b">' + eur(r[1]) + '</td><td class="a">' + eur(r[2]) + '</td><td class="d ' + (d ? (good ? "up" : "dn") : "") + '">' + (d ? (d > 0 ? "+" : "−") + eur(Math.abs(d)) : "—") + '</td></tr>'; }).join("");
    var mx = Math.max(Math.abs(c0.net), Math.abs(c1.net), 1);
    var bars = '<div class="bars"><div class="bar before"><span class="small">Avant</span><span class="t"><i style="width:' + Math.max(1, Math.abs(c0.net) / mx * 78) + '%"></i>' + fmtTax(c0.net) + '</span></div>' +
      '<div class="bar after"><span class="small">Après</span><span class="t"><i style="width:' + Math.max(1, Math.abs(c1.net) / mx * 78) + '%"></i>' + fmtTax(c1.net) + '</span></div></div>';
    /* Plan unique : sécurité, gratuit, épargne qui rapporte, déductions, dépenses, risque */
    var al = allocation(c0), items = [];
    var safeAmt = al.lines.filter(function (L) { return L.env === "lep" || L.env === "livretA"; }).reduce(function (s, L) { return s + L.cap; }, 0);
    if (safeAmt > 0) items.push({p: 1, nom: "Garder " + eur(safeAmt) + " de précaution sur livrets", sub: al.lepOK ? "LEP d'abord (2,5 %), puis Livret A et LDDS" : "Livret A et LDDS, disponibles tout de suite", val: "Sécurité", cls: "info"});
    var NAT = {"Gratuit": 2, "Épargne conservée": 4, "Dépense": 5, "Placement risqué": 6};
    LEVERS.forEach(function (L) { var gg = gainOf(L, c0); if (gg <= 0) return;
      var done = L.pas.filter(function (p, i) { return S.todo[L.id + i]; }).length;
      items.push({p: NAT[L.nature], nom: L.nom, sub: (L.toggle ? "Option à cocher" : eur(+S.plan[L.id])) + " · case " + L.case + " · " + done + "/" + L.pas.length + " étapes faites", val: "−" + eur(gg) + " d'impôt", cls: "good"}); });
    var gEp = al.apres - al.avant;
    if (gEp > 0) items.push({p: 3, nom: "Faire travailler votre épargne", sub: al.lines.filter(function (L) { return ["fe", "uc", "pea"].indexOf(L.env) >= 0; }).map(function (L) { return F.ENV[L.env].court + " " + eur(L.cap); }).join(" · ") + " · sur " + al.H + " ans", val: "+" + eur(gEp) + " nets", cls: "good"});
    items.sort(function (a, b) { return a.p - b.p; });
    var plan = items.map(function (it, i) { return '<div class="kv"><span><span class="eyebrow">Priorité ' + (i + 1) + '</span><br><b>' + esc(it.nom) + '</b><br><span class="hint">' + esc(it.sub) + '</span></span><span class="tag ' + it.cls + '" style="align-self:center">' + esc(it.val) + '</span></div>'; }).join("");
    var auto = [];
    if (c0.scol > 0) auto.push("Réduction scolarité : " + eur(c0.scol));
    if (c0.fraisReelsRetenus) auto.push("Frais réels retenus au lieu de l'abattement de 10 % (" + eur(c0.a1) + ")");
    if (c0.decote > 0) auto.push("Décote appliquée : " + eur(c0.decote));
    var lost = (c1.credits + c1.reds) >= D.commun.plafondGlobal - 1;
    return '<section class="card">' + progress() + '<h2>Avant / après optimisation</h2>' + bars +
      '<div class="tbl"><table><thead><tr><th>Poste</th><th class="b">Avant</th><th class="a">Après</th><th>Écart</th></tr></thead><tbody>' + tr +
      '<tr class="total"><td>Impôt final</td><td class="b">' + fmtTax(c0.net) + '</td><td class="a">' + fmtTax(c1.net) + '</td><td class="d up">−' + eur(g) + '</td></tr></tbody></table></div>' +
      (lost ? '<p class="notice">Vous atteignez le plafond global de 10 000 € des niches fiscales : au-delà, l\'avantage est perdu.</p>' : '') + '</section>' +
      '<section class="card"><h3>Votre plan d\'action priorisé</h3><p class="small muted">Dans l\'ordre : sécurité, ce qui est gratuit, l\'épargne qui rapporte, puis les déductions et les dépenses.</p>' + (plan || '<p class="muted small">Aucun levier activé. Revenez à l\'étape Leviers et entrez des montants.</p>') +
      '<button type="button" class="btn" data-tab="f">Détail de l\'épargne et projection</button>' +
      (auto.length ? '<p class="eyebrow" style="margin-top:6px">Déjà pris en compte</p><p class="small muted">' + auto.map(esc).join(" · ") + '</p>' : '') +
      '<p class="small muted">Prochaine étape : cochez les démarches dans chaque levier au fur et à mesure. À la déclaration de printemps, reportez chaque montant dans la case indiquée.</p>' +
      navBtns() + '<button type="button" class="btn ghost" data-restart="1">Recommencer le parcours</button></section>';
  }

  /* ---------- Fructifier : répartition simulée et projection ---------- */
  function ctxEp(c) {
    return {couple: S.situation === "couple", tmi: c.tmi, tmiSortie: S.hyp.tmiSortie != null && S.hyp.tmiSortie !== "" ? +S.hyp.tmiSortie : Math.min(c.tmi, 0.11),
      profil: S.profil, hyp: S.hyp, ans: Math.max(1, Math.min(40, Math.round(+S.horizon || 1)))};
  }
  function ageEnv(env) {
    if (env === "pea") return S.peaOuvert === "oui" && +S.peaAnnee > 1990 ? Math.max(0, NOW_Y - +S.peaAnnee) : 0;
    if (env === "fe" || env === "uc") return S.avOuvert === "oui" && +S.avAnnee > 1950 ? Math.max(0, NOW_Y - +S.avAnnee) : 0;
    return 0;
  }
  function allocation(c) {
    var E = D.epargne, o = ctxEp(c), H = o.ans;
    var dormant = Math.max(0, +S.epCourant || 0) + Math.max(0, +S.epLivret || 0);
    var prec = Math.max(0, +S.moisPrecaution || 0) * Math.max(0, +S.depensesMois || 0);
    var lepOK = c.parts > 0 && c.rni / c.parts <= E.lep.rfrPart;
    var lines = [], add = function (env, cap, men, why) { if (cap > 0.5 || men > 0.5) lines.push({env: env, cap: cap, men: men, why: why}); };
    // 1. Sécurité
    var safe = Math.min(dormant, prec), s = safe;
    if (lepOK) { var l = Math.min(s, E.lep.plafond); add("lep", l, 0, "Épargne de précaution, meilleur livret sans risque (si éligible)"); s -= l; }
    var la = Math.min(s, E.livretA.plafond + E.ldds.plafond); add("livretA", la, 0, "Épargne de précaution, disponible tout de suite"); s -= la;
    if (s > 0) add("fe", s, 0, "Précaution au-delà des plafonds des livrets");
    // 2. Rendement
    var reste = dormant - safe, men = Math.max(0, +S.epMensuel || 0), w;
    if (H < 3) w = {fe: 1};
    else if (S.profil === "prudent") w = {fe: 0.7, uc: 0.3};
    else if (S.profil === "dynamique") w = H < 5 ? {fe: 0.3, uc: 0.7} : {pea: 0.7, uc: 0.3};
    else w = H < 5 ? {fe: 0.5, uc: 0.5} : {pea: 0.5, uc: 0.3, fe: 0.2};
    if (S.retraite === "oui" && c.tmi >= 0.30 && H >= 5) { for (var k in w) w[k] *= 0.7; w.per = 0.3; }
    var why = {fe: "Capital garanti, disponible, horloge fiscale des 8 ans", uc: "Plus de rendement, fiscalité douce après 8 ans", pea: "Le plus rentable à long terme, gains sans impôt après 5 ans", per: "Déduction d'impôt à " + pct(c.tmi) + " aujourd'hui, bloqué jusqu'à la retraite"};
    for (var e in w) {
      var cap = reste * w[e], mm = men * w[e];
      if (e === "per") { var lim = Math.max(0, c.perRem); cap = Math.min(cap, lim); }
      add(e, cap, mm, why[e]);
    }
    if (men > 0 && H < 3 && !w.fe) add("livretA", 0, men, "Versements mensuels");
    // Projection
    lines.forEach(function (L) {
      L.p = F.projeter(L.env, Object.assign({}, o, {capital: L.cap, mensuel: L.men, ageDeja: ageEnv(L.env)}));
    });
    var apres = lines.reduce(function (s, L) { return s + L.p.fin.net; }, 0);
    // Situation actuelle : livrets au Livret A, compte courant à 0 %, épargne mensuelle sur le compte courant
    var av1 = F.projeter("livretA", Object.assign({}, o, {capital: Math.max(0, +S.epLivret || 0)}));
    var av2 = F.projeter("courant", Object.assign({}, o, {capital: Math.max(0, +S.epCourant || 0), mensuel: men}));
    var avant = av1.fin.net + av2.fin.net;
    var serieApres = [], serieAvant = [];
    for (var a = 0; a <= H; a++) {
      serieApres.push(lines.reduce(function (s, L) { return s + L.p.serie[a].net; }, 0));
      serieAvant.push(av1.serie[a].net + av2.serie[a].net);
    }
    var verse = dormant + men * 12 * H;
    return {lines: lines, avant: avant, apres: apres, dormant: dormant, prec: prec, lepOK: lepOK, H: H, verse: verse, serieApres: serieApres, serieAvant: serieAvant, o: o};
  }

  function lineChart(series, H) {
    var W = 340, Hh = 190, pl = 52, pr = 8, pt = 10, pb = 24;
    var all = []; series.forEach(function (s) { all = all.concat(s.v); });
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all);
    var step = Math.pow(10, Math.floor(Math.log10(Math.max(1, mx - mn)))) || 1;
    var n = (mx - mn) / step; if (n < 2) step /= 5; else if (n < 4) step /= 2;
    var lo = Math.floor(mn / step) * step, hi = Math.ceil(mx / step) * step; if (hi === lo) hi = lo + step;
    var x = function (i) { return pl + (W - pl - pr) * i / Math.max(1, H); };
    var y = function (v) { return pt + (Hh - pt - pb) * (1 - (v - lo) / (hi - lo)); };
    var g = "", t;
    for (t = lo; t <= hi + 0.001; t += step) g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(t) + '" y2="' + y(t) + '" class="grid"/><text x="' + (pl - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end" class="axis">' + (Math.abs(hi) >= 10000 ? Math.round(t / 1000) + " k€" : Math.round(t) + " €") + '</text>';
    var xt = [0, Math.round(H / 2), H].filter(function (v, i, a) { return a.indexOf(v) === i; });
    xt.forEach(function (i) { g += '<text x="' + x(i) + '" y="' + (Hh - 6) + '" text-anchor="' + (i === 0 ? "start" : i === H ? "end" : "middle") + '" class="axis">' + (i === 0 ? "auj." : "+" + i + " ans") + '</text>'; });
    series.forEach(function (s) {
      var d = s.v.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
      if (s.area) g += '<path d="' + d + ' L' + x(H) + ' ' + y(lo) + ' L' + x(0) + ' ' + y(lo) + 'Z" fill="' + s.c + '" opacity=".12"/>';
      g += '<path d="' + d + '" fill="none" stroke="' + s.c + '" stroke-width="' + (s.w || 2) + '"' + (s.dash ? ' stroke-dasharray="4 3"' : '') + '/>';
      g += '<circle cx="' + x(H) + '" cy="' + y(s.v[H]) + '" r="3.5" fill="' + s.c + '"/>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" class="chart" role="img" aria-label="Évolution de l\'épargne nette">' + g + '</svg>';
  }

  function fructifierTab() {
    var c = F.compute(S), al = allocation(c), E = D.epargne, o = al.o, H = al.H;
    var gain = al.apres - al.avant;
    var h = '<section class="card"><span class="eyebrow">Faire fructifier</span><h2>Ce que votre argent peut devenir en ' + H + ' ans</h2>' +
      '<div class="ba"><div class="side before"><span class="k">Si rien ne change</span><span class="v">' + eur(al.avant) + '</span></div><div class="arrow" aria-hidden="true">→</div>' +
      '<div class="side after"><span class="k">Avec la répartition</span><span class="v">' + eur(al.apres) + '</span></div>' +
      '<div class="delta"><span>Gain net estimé : <b>' + eur(gain) + '</b></span><span class="muted">soit ' + eur(gain / H) + ' par an · ' + eur(al.verse) + ' versés</span></div></div>' +
      lineChart([{v: al.serieAvant, c: "var(--bad)", dash: true}, {v: al.serieApres, c: "var(--good)", w: 2.5, area: true}], H) +
      '<div class="legend"><span class="tag bad">Aujourd\'hui : compte courant à 0 % et livrets à ' + pct(E.livretA.taux) + '</span><span class="tag good">Répartition simulée, net d\'impôts</span></div>' +
      '<div class="row2"><div class="fld"><label for="f_horizon"><span>Horizon</span><span class="case">' + H + ' ans</span></label><input id="f_horizon" data-k="horizon" type="range" min="1" max="30" step="1" value="' + H + '"></div>' +
      '<div class="fld"><label for="f_epMensuel2"><span>Épargne mensuelle</span></label><input id="f_epMensuel2" data-k="epMensuel" type="number" inputmode="decimal" min="0" value="' + (S.epMensuel || "") + '" placeholder="0"></div></div>' +
      '<div class="chips" role="group" aria-label="Profil">' + ["prudent", "equilibre", "dynamique"].map(function (p) { return '<button type="button" data-profil="' + p + '" aria-pressed="' + (S.profil === p) + '">' + E.profils[p].label + '</button>'; }).join("") + '</div>' +
      (al.dormant <= 0 ? '<p class="notice">Indiquez votre argent qui dort à l\'étape Épargne du parcours.</p>' : '') + '</section>';

    // Répartition priorisée
    var ord = {lep: 1, livretA: 1, fe: 2, uc: 3, pea: 3, per: 4};
    var lines = al.lines.slice().sort(function (a, b) { return ord[a.env] - ord[b.env]; });
    h += '<section class="card"><h3>Répartition simulée, par priorité</h3><p class="small muted">D\'abord la sécurité (' + eur(al.prec) + ' de précaution), puis le rendement selon votre horizon et votre profil.</p>' +
      lines.map(function (L, i) {
        var risk = {lep: ["good", "Garanti"], livretA: ["good", "Garanti"], fe: ["good", "Capital garanti"], uc: ["warn", "Peut baisser"], pea: ["bad", "Peut baisser"], per: ["warn", "Bloqué"]}[L.env];
        var ag = ageEnv(L.env), clock = (L.env === "pea" ? 5 : (L.env === "fe" || L.env === "uc") ? 8 : 0);
        var clockTxt = clock ? (ag + H >= clock ? "Avantage fiscal acquis à la sortie" : "Avantage fiscal acquis en " + (NOW_Y + clock - ag)) : "";
        if ((L.env === "fe" || L.env === "uc") && S.avOuvert !== "oui") clockTxt += " · À ouvrir maintenant pour lancer le compteur des 8 ans";
        if (L.env === "pea" && S.peaOuvert !== "oui") clockTxt += " · À ouvrir maintenant pour lancer le compteur des 5 ans";
        return '<div class="alloc"><div class="alloc-h"><span class="eyebrow">' + (i + 1) + ' · ' + esc(F.ENV[L.env].nom) + '</span><span class="tag ' + risk[0] + '">' + risk[1] + '</span></div>' +
          '<div class="figs"><div><span class="k">À placer</span><b>' + eur(L.cap) + '</b></div><div><span class="k">Par mois</span><b>' + eur(L.men) + '</b></div><div class="g"><span class="k">Net dans ' + H + ' ans</span><b>' + eur(L.p.fin.net) + '</b></div></div>' +
          '<p class="hint">' + esc(L.why) + ' · hypothèse ' + pct(L.p.taux) + '/an' + (clockTxt ? ' · ' + clockTxt : '') + '</p></div>';
      }).join("") + '</section>';

    // Comparaison des enveloppes
    var cap = 10000, envs = ["courant", "livretA", "fe", "uc", "pea", "cto"].concat(c.tmi > 0 ? ["per"] : []);
    var rows = envs.map(function (e) { var p = F.projeter(e, Object.assign({}, o, {capital: cap, mensuel: 0, ageDeja: ageEnv(e)})); return {e: e, p: p}; })
      .sort(function (a, b) { return b.p.fin.net - a.p.fin.net; });
    var dispo = {courant: "Immédiate", livretA: "Immédiate", lep: "Immédiate", fe: "Quelques jours", uc: "Quelques jours", pea: "Retrait avant 5 ans = clôture", cto: "Quelques jours", per: "Retraite"};
    h += '<section class="card"><h3>Comparer : 10 000 € placés pendant ' + H + ' ans</h3><div class="tbl"><table><thead><tr><th>Enveloppe</th><th>Taux</th><th>Net</th><th>Gain</th></tr></thead><tbody>' +
      rows.map(function (r) { var gg = r.p.fin.net - cap; return '<tr><td>' + esc(F.ENV[r.e].court) + '<br><span class="hint">' + dispo[r.e] + '</span></td><td class="num">' + pct(r.p.taux) + '</td><td class="num">' + eur(r.p.fin.net) + '</td><td class="d ' + (gg > 0 ? "up" : "") + '">' + (gg > 0 ? "+" : "") + eur(gg) + '</td></tr>'; }).join("") +
      '</tbody></table></div><p class="hint">Net = ce que vous touchez en retirant tout au bout de ' + H + ' ans, après impôt et prélèvements sociaux. PER : déduction à ' + pct(c.tmi) + ' à l\'entrée incluse, sortie imposée à ' + pct(o.tmiSortie) + ' (hypothèse retraite).</p></section>';

    // Hypothèses
    var hy = [["livretA", "Livret A / LDDS"], ["lep", "LEP"], ["fe", "Fonds euros"], ["uc", "Unités de compte"], ["pea", "PEA / actions"], ["cto", "Compte-titres"]];
    h += '<section class="card"><details><summary>Modifier les hypothèses de rendement</summary><p class="hint" style="margin:8px 0">En % par an. Livrets : taux officiels. Fonds euros et UC : moyennes 2025. Actions : moyenne historique de long terme, non garantie.</p><div class="row2">' +
      hy.map(function (x) { var v = S.hyp[x[0]]; var d = Math.round(F.tauxEnv(x[0], S.profil, {}) * 1000) / 10; return '<div class="fld"><label for="h_' + x[0] + '"><span>' + x[1] + '</span></label><input id="h_' + x[0] + '" data-hyp="' + x[0] + '" type="number" step="0.1" inputmode="decimal" value="' + (v != null && v !== "" ? Math.round(v * 1000) / 10 : "") + '" placeholder="' + d + '"></div>'; }).join("") +
      '<div class="fld"><label for="h_tmiSortie"><span>Tranche à la retraite</span></label><input id="h_tmiSortie" data-hyp="tmiSortie" type="number" step="1" inputmode="decimal" value="' + (S.hyp.tmiSortie != null && S.hyp.tmiSortie !== "" ? Math.round(S.hyp.tmiSortie * 100) : "") + '" placeholder="' + Math.round(o.tmiSortie * 100) + '"></div></div></details>' +
      '<p class="hint">Ces chiffres sont des simulations, pas des promesses. Les unités de compte et les actions peuvent perdre de la valeur. Inflation prévue : ' + pct(E.inflation) + ' par an, à garder en tête.</p></section>';
    return h;
  }

  /* ---------- Audit ---------- */
  function auditTab() {
    var fams = ["Tous"].concat(A.map(function (x) { return x.fam; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
    var list = A.filter(function (x) { return S.fam === "Tous" || x.fam === S.fam; });
    var stCls = {ouvert: "good", "vérifier": "warn", "fermé": "bad"};
    var rkCls = {faible: "good", moyen: "warn", "élevé": "bad"};
    return '<section class="card"><h2>Audit de ' + A.length + ' leviers</h2><p class="small muted">Recensement issu d\'une recherche web et des règles d\'OpenFisca-France, au ' + D.maj + '. « Simulé » : calculé dans le parcours. Les autres demandent un conseil personnalisé ou un projet précis.</p>' +
      '<div class="chips">' + fams.map(function (f) { return '<button type="button" data-fam="' + esc(f) + '" aria-pressed="' + (S.fam === f) + '">' + esc(f) + '</button>'; }).join("") + '</div></section>' +
      list.map(function (x) {
        return '<article class="card"><header style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><span class="eyebrow">' + esc(x.fam) + '</span><h3>' + esc(x.nom) + '</h3></div><div class="tags">' +
          '<span class="tag ' + stCls[x.statut] + '">' + esc(x.statut) + '</span>' + (x.simule ? '<span class="tag info">Simulé</span>' : '') + '</div></header>' +
          '<div class="kv"><span class="muted">Avantage</span><span style="text-align:right">' + esc(x.avantage) + '</span></div>' +
          '<div class="kv"><span class="muted">Plafond</span><span style="text-align:right">' + esc(x.plafond) + '</span></div>' +
          '<div class="kv"><span class="muted">Blocage</span><span style="text-align:right">' + esc(x.blocage) + '</span></div>' +
          '<div class="kv"><span class="muted">Risque</span><span class="tag ' + rkCls[x.risque] + '">' + esc(x.risque) + '</span></div>' +
          '<p class="small muted">' + esc(x.note) + '</p></article>';
      }).join("");
  }

  /* ---------- Barèmes ---------- */
  function baremeTab() {
    var Y = D.years[S.annee], C = D.commun;
    var badge = function (s) { return '<span class="tag ' + (s === "officiel" ? "good" : "warn") + '">' + s + '</span>'; };
    var prev = 0, rows = Y.tranches.map(function (t) { var r = '<tr><td>' + eur(prev) + ' à ' + (t[0] === Infinity ? "plus" : eur(t[0])) + '</td><td class="num">' + pct(t[1]) + '</td></tr>'; prev = t[0]; return r; }).join("");
    var params = [["Plafond du quotient familial (demi-part)", eur(Y.plafondQF), "estimé"], ["Décote seul / couple", eur(Y.decote.seul) + " / " + eur(Y.decote.couple), Y.statutBareme],
      ["Abattement 10 % (min / max)", eur(Y.abatt.min) + " / " + eur(Y.abatt.max), "estimé"], ["Plafond PER (min / max)", eur(Y.per.min) + " / " + eur(Y.per.max), "officiel"],
      ["Dons à 75 %", "jusqu'à " + eur(Y.don75), "officiel"], ["Pension enfant majeur", eur(Y.pensionMajeur), "estimé"], ["Plafond global des niches", eur(C.plafondGlobal), "officiel"]]
      .map(function (p) { return '<tr><td>' + p[0] + '</td><td class="num">' + p[1] + '</td><td>' + badge(p[2]) + '</td></tr>'; }).join("");
    return '<section class="card"><h2>' + esc(Y.label) + '</h2><p class="small muted">Barème ' + badge(Y.statutBareme) + ' · mis à jour le ' + D.maj + '</p>' +
      '<div class="tbl"><table><thead><tr><th>Revenu par part</th><th>Taux</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
      '<section class="card"><h3>Autres paramètres</h3><div class="tbl"><table><tbody>' + params + '</tbody></table></div><p class="hint">« projet » : texte déposé, pas encore voté. « estimé » : calculé par indexation de 2,1 %, à confirmer.</p></section>' +
      '<section class="card"><h3>Sources</h3><ul class="small" style="margin:0;padding-left:18px">' + D.sources.map(function (s) { return '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + esc(s[0]) + '</a></li>'; }).join("") + '</ul>' +
      '<p class="hint">Mise à jour annuelle : remplacer les valeurs du fichier params.js par celles de la loi de finances votée.</p></section>' +
      '<section class="card"><h3>Vos données</h3><p class="small muted">Elles sont enregistrées uniquement dans ce navigateur, sur cet appareil. Personne d\'autre ne les voit, même avec le même lien.</p><button type="button" class="btn" data-clear="1">Effacer mes données</button></section>';
  }

  /* ---------- Rendu et événements ---------- */
  function render(keepFocus) {
    var fid = keepFocus && document.activeElement ? document.activeElement.id : null;
    var sel = fid ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    var body;
    var t = STEPS[S.step] ? STEPS[S.step].t : "Bienvenue";
    if (S.tab === "a") body = auditTab();
    else if (S.tab === "b") body = baremeTab();
    else if (S.tab === "f") body = fructifierTab();
    else if (t === "Bienvenue") body = stepWelcome();
    else if (t === "Leviers") body = stepLevers();
    else if (t === "Résultat") body = stepResult();
    else body = stepForm(STEPS[S.step]);
    app.innerHTML = head() + body + '<p class="disc">Simulation indicative, ni conseil fiscal ni conseil en investissement. Vérifiez sur impots.gouv.fr avant d\'agir. Ouvrir un PER, une assurance-vie ou un PEA se fait auprès de l\'établissement de votre choix.</p>';
    if (fid) { var el = document.getElementById(fid); if (el) { el.focus(); try { if (sel && el.type !== "number") el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  }
  function updateHead() {
    var tmp = document.createElement("div"); tmp.innerHTML = head();
    var ba = app.querySelector(".ba"); if (ba) ba.replaceWith(tmp.querySelector(".ba"));
  }

  app.addEventListener("click", function (e) {
    var t = e.target.closest("button, input[type=checkbox]"); if (!t) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
    if (t.dataset.go) { S.step = Math.max(0, Math.min(STEPS.length - 1, S.step + (+t.dataset.go))); save(); render(); window.scrollTo(0, 0); return; }
    if (t.dataset.choice) { S[t.dataset.choice] = t.dataset.val; S.exemple = false; save(); render(); return; }
    if (t.dataset.fam) { S.fam = t.dataset.fam; save(); render(); return; }
    if (t.dataset.profil) { S.profil = t.dataset.profil; save(); render(); return; }
    if (t.dataset.fill) { S.plan[t.dataset.fill] = +t.dataset.v; save(); render(); return; }
    if (t.dataset.toggle) { S.plan[t.dataset.toggle] = t.checked; save(); render(); return; }
    if (t.dataset.todo) { S.todo[t.dataset.todo] = t.checked; save(); t.closest("li").className = t.checked ? "done" : ""; return; }
    if (t.dataset.restart) { S.step = 0; S.tab = "p"; save(); render(); window.scrollTo(0, 0); return; }
    if (t.dataset.clear) {
      if (t.dataset.clear === "1") { t.dataset.clear = "2"; t.textContent = "Confirmer : tout effacer"; return; }
      S = clone(DEFAULTS); try { localStorage.removeItem(KEY); } catch (e2) {}
      render(); window.scrollTo(0, 0); return;
    }
  });
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.dataset.k) { S[t.dataset.k] = t.value === "" ? 0 : +t.value; S.exemple = false; save(); if (S.tab === "f") render(true); else updateHead(); return; }
    if (t.dataset.hyp) { var hk = t.dataset.hyp; S.hyp[hk] = t.value === "" ? "" : (hk === "tmiSortie" ? +t.value / 100 : +t.value / 100); save(); render(true); return; }
    if (t.dataset.plan) {
      S.plan[t.dataset.plan] = t.value === "" ? 0 : +t.value; save(); updateHead();
      var L = LEVERS.filter(function (x) { return x.id === t.dataset.plan; })[0];
      var res = t.closest(".lv").querySelector(".res"); var g = gainOf(L, F.compute(S));
      if (res) { res.className = "res" + (g > 0 ? "" : " off"); res.querySelector("b").textContent = eur(g); }
    }
  });
  app.addEventListener("submit", function (e) { e.preventDefault(); });

  render();
})();
