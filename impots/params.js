/* =====================================================================
   PARAMÈTRES FISCAUX ET CATALOGUE DES LEVIERS
   Seul fichier à mettre à jour chaque automne (loi de finances votée).
   statut : "officiel" (loi votée) · "projet" (PLF non voté) · "estimé" (indexation calculée)
   ===================================================================== */
var DATA = {
  maj: "24/10/2026",
  dateLimite: {"2026": "2026-12-31", "2025": "2025-12-31"},
  years: {
    "2026": {
      label: "Revenus 2026 (impôt payé en 2027)",
      statutBareme: "projet",
      tranches: [[11844,0],[30200,0.11],[86353,0.30],[185737,0.41],[Infinity,0.45]],
      plafondQF: 1845,
      decote: {seul: 915, couple: 1513, taux: 0.4525},
      abatt: {min: 509, max: 14599},
      per: {min: 4710, max: 37680},
      don75: 2000,
      pensionMajeur: 6999
    },
    "2025": {
      label: "Revenus 2025 (impôt payé en 2026)",
      statutBareme: "officiel",
      tranches: [[11600,0],[29579,0.11],[84577,0.30],[181917,0.41],[Infinity,0.45]],
      plafondQF: 1807,
      decote: {seul: 897, couple: 1483, taux: 0.4525},
      abatt: {min: 499, max: 14299},
      per: {min: 4637, max: 37094},
      don75: 2000,
      pensionMajeur: 6855
    }
  },
  commun: {
    plafondGlobal: 10000,
    emploi: {taux: 0.5, base: 12000, parEnfant: 1500, max: 15000},
    garde: {taux: 0.5, parEnfant: 3500},
    dons: {taux66: 0.66, taux75: 0.75, limiteRevenu: 0.20},
    syndic: {taux: 0.66, limiteSalaires: 0.01},
    irpme: {taux: 0.18, plafondSeul: 50000, plafondCouple: 100000},
    fcpi: {taux: 0.25, plafondSeul: 12000, plafondCouple: 24000},
    ehpad: {taux: 0.25, plafond: 10000},
    scolarite: {col: 61, lyc: 153, sup: 183},
    capital: {pfuIR: 0.128, abattDividendes: 0.40}
  },
  /* Épargne : taux en vigueur (livrets, fonds euros) et hypothèses de rendement modifiables dans l'appli */
  epargne: {
    livretA: {taux: 0.017, plafond: 22950, statut: "officiel", note: "1,7 % du 01/08/2026 au 31/01/2027"},
    ldds: {taux: 0.017, plafond: 12000, statut: "officiel"},
    lep: {taux: 0.025, plafond: 10000, rfrPart: 23028, statut: "officiel", note: "Réservé aux revenus modestes (revenu fiscal ≤ 23 028 € par part en 2026)"},
    fondsEuros: {taux: 0.026, statut: "moyenne 2025", note: "Rendement moyen 2025 net de frais (France Assureurs), non garanti pour la suite"},
    profils: {
      prudent:   {label: "Prudent",   uc: 0.030, actions: 0.040},
      equilibre: {label: "Équilibré", uc: 0.047, actions: 0.055},
      dynamique: {label: "Dynamique", uc: 0.060, actions: 0.070}
    },
    inflation: 0.021,
    fisc: {pfuIR: 0.128, psAV: 0.172, psAutres: 0.186, avIR8: 0.075, avAbattSeul: 4600, avAbattCouple: 9200, peaAns: 5, avAns: 8, peaPlafond: 150000}
  },
  sources: [
    ["Taux Livret A, LDDS, LEP — comparonslesbanques.com", "https://www.comparonslesbanques.com/taux/livret-a/"],
    ["Fonds euros 2025 à 2,6 %, UC à 4,7 % — meilleurtaux.com", "https://placement.meilleurtaux.com/assurance-vie/actualites/2026-mars/assurance-vie-2025-fonds-euros-a-2-6-selon-france-assureurs.html"],
    ["Fiscalité de l'assurance-vie 2026 — toutsurmesfinances.com", "https://www.toutsurmesfinances.com/placements/?p=55821"],
    ["Impôts.gouv.fr — espace particulier", "https://www.impots.gouv.fr/particulier"],
    ["Service-public.fr — fiscalité des particuliers", "https://www.service-public.fr/particuliers"],
    ["BOFiP — doctrine fiscale officielle", "https://bofip.impots.gouv.fr/"],
    ["OpenFisca-France — moteur de règles open source", "https://github.com/openfisca/openfisca-france"],
    ["Barème 2027 (PLF) — toutsurmesfinances.com", "https://www.toutsurmesfinances.com/actualites/a/impot-sur-le-revenu-bareme-releve-de-21-voici-les-tranches-pour-2027"],
    ["Niches fiscales 2026 — cleerly.fr", "https://cleerly.fr/defiscalisation/niches-fiscales"],
    ["Loi de finances 2026 pour l'épargne — linxea.com", "https://www.linxea.com/actualites/toutes-les-actualites/loi-de-finances-2026-ce-qui-change-pour-les-epargnants/"]
  ]
};

/* Catalogue d'audit : tous les leviers repérés. simule = calculé par l'appli. */
var AUDIT = [
  {id:"per", fam:"Retraite", nom:"Plan d'épargne retraite (PER)", avantage:"Déduction du revenu imposable : économie = votre tranche marginale", plafond:"10 % des revenus pro, de 4 710 € à 37 680 € (versements 2026), report des plafonds non utilisés", blocage:"Jusqu'à la retraite", risque:"faible", statut:"ouvert", simule:true, note:"Depuis 2026, plus de déduction après 70 ans. Report des plafonds porté de 3 à 5 ans. Sortie imposée."},
  {id:"bareme", fam:"Épargne", nom:"Option barème plutôt que PFU", avantage:"Imposer dividendes et intérêts au barème au lieu de 12,8 %", plafond:"Aucun", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Utile si votre tranche est à 0 % ou 11 %. Depuis 2026, l'option n'est plus irrévocable. Prélèvements sociaux à 18,6 % dans les deux cas."},
  {id:"don75", fam:"Dons", nom:"Dons aux associations d'aide aux personnes en difficulté", avantage:"Réduction de 75 %", plafond:"2 000 € de dons au taux de 75 % (case 7UD)", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Plafond relevé de 1 000 à 2 000 € pour les dons faits à partir du 14 octobre 2025."},
  {id:"don66", fam:"Dons", nom:"Dons aux organismes d'intérêt général", avantage:"Réduction de 66 %", plafond:"20 % du revenu imposable (case 7UF), excédent reportable 5 ans", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Hors plafond global de 10 000 €."},
  {id:"emploi", fam:"Services & santé", nom:"Emploi d'un salarié à domicile", avantage:"Crédit d'impôt de 50 %, remboursé même sans impôt", plafond:"12 000 € + 1 500 € par enfant, max 15 000 € (case 7DB)", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Le formulaire 2026 demande de déclarer l'employé ou l'organisme prestataire."},
  {id:"garde", fam:"Famille", nom:"Garde d'enfant de moins de 6 ans hors domicile", avantage:"Crédit d'impôt de 50 %", plafond:"3 500 € par enfant, 1 750 € en garde alternée (case 7GA)", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Crèche, assistante maternelle agréée, garderie."},
  {id:"scol", fam:"Famille", nom:"Frais de scolarité des enfants", avantage:"Réduction forfaitaire par enfant", plafond:"61 € collège, 153 € lycée, 183 € supérieur", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Calculée automatiquement. Souvent oubliée."},
  {id:"ehpad", fam:"Services & santé", nom:"Dépendance et hébergement en EHPAD", avantage:"Réduction de 25 %", plafond:"10 000 € de dépenses par personne", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Cumulable avec le crédit d'emploi à domicile pour un parent âgé."},
  {id:"syndic", fam:"Famille", nom:"Cotisations syndicales", avantage:"Crédit d'impôt de 66 %", plafond:"1 % du salaire (case 7AC)", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Remboursé même sans impôt."},
  {id:"pension", fam:"Famille", nom:"Aide à un enfant majeur (pension alimentaire)", avantage:"Déduction du revenu imposable", plafond:"Environ 6 999 € par enfant majeur (case 6EL)", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Enfant non rattaché au foyer, besoin réel à justifier."},
  {id:"frais", fam:"Règles clés", nom:"Frais réels au lieu de l'abattement de 10 %", avantage:"Déduire vos frais réels de transport, repas, formation", plafond:"Aucun, avec justificatifs", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Retenus automatiquement si supérieurs à l'abattement de 10 %."},
  {id:"fcpi", fam:"Investissement", nom:"FCPI / FIP (fonds de PME innovantes)", avantage:"Réduction de 25 % selon la source consultée", plafond:"12 000 € (24 000 € en couple)", blocage:"Parts conservées 5 ans", risque:"élevé", statut:"vérifier", simule:true, note:"Perte en capital possible. Taux à confirmer sur le texte en vigueur."},
  {id:"irpme", fam:"Investissement", nom:"Investissement au capital de PME (IR-PME)", avantage:"Réduction de 18 %", plafond:"50 000 € (100 000 € en couple) (case 7CF)", blocage:"Titres conservés 5 ans", risque:"élevé", statut:"ouvert", simule:true, note:"Soumis au plafond global de 10 000 €."},
  {id:"gfv", fam:"Investissement", nom:"Groupement forestier", avantage:"Crédit d'impôt de 25 %", plafond:"6 250 € (12 500 € en couple)", blocage:"Engagement de gestion durable", risque:"moyen", statut:"ouvert", simule:false, note:"Non simulé."},
  {id:"sofica", fam:"Investissement", nom:"SOFICA (cinéma et audiovisuel)", avantage:"Réduction de 30 %, jusqu'à 48 %", plafond:"18 000 € ou 25 % du revenu net global", blocage:"Conservation des titres plusieurs années", risque:"élevé", statut:"ouvert", simule:false, note:"Investissement risqué. Plafond global majoré à 18 000 €."},
  {id:"girardin", fam:"Investissement", nom:"Girardin industriel / social (outre-mer)", avantage:"Réduction pouvant dépasser 100 % de la somme investie", plafond:"18 000 €", blocage:"Conservation 5 ans", risque:"élevé", statut:"ouvert", simule:false, note:"Montage complexe : passer par un conseiller indépendant."},
  {id:"handicap", fam:"Services & santé", nom:"Épargne handicap / rente survie", avantage:"Réduction de 25 %", plafond:"1 525 € de cotisations, majoré par enfant", blocage:"Contrat de 6 ans minimum", risque:"faible", statut:"ouvert", simule:false, note:"Non simulé."},
  {id:"travaux_age", fam:"Services & santé", nom:"Travaux pour personne âgée ou handicapée", avantage:"Crédit d'impôt de 25 %", plafond:"5 000 € (10 000 € en couple)", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:false, note:"Dernière année d'application annoncée pour 2026 dans une des sources. À vérifier."},
  {id:"borne", fam:"Services & santé", nom:"Borne de recharge de véhicule électrique", avantage:"Crédit d'impôt de 75 %", plafond:"500 € par système", blocage:"Aucun", risque:"faible", statut:"vérifier", simule:false, note:"Conditions d'installation à vérifier."},
  {id:"pinel", fam:"Immobilier", nom:"Pinel / Pinel+", avantage:"Réduction sur 6, 9 ou 12 ans", plafond:"Jusqu'à 63 000 € sur 12 ans", blocage:"Location 6 à 12 ans", risque:"moyen", statut:"fermé", simule:false, note:"Fermé aux nouveaux investissements depuis 2025."},
  {id:"denormandie", fam:"Immobilier", nom:"Denormandie (ancien à rénover)", avantage:"Réduction de 12 % à 21 %", plafond:"Jusqu'à 63 000 € sur 12 ans", blocage:"Location 6 à 12 ans", risque:"moyen", statut:"vérifier", simule:false, note:"Annoncé prolongé jusqu'au 31/12/2027 par une des sources. À vérifier."},
  {id:"jeanbrun", fam:"Immobilier", nom:"Dispositif « Jeanbrun » (achats depuis le 21/02/2026)", avantage:"Nouveau régime d'investissement locatif", plafond:"Voir le texte en vigueur", blocage:"Durée de location à vérifier", risque:"moyen", statut:"vérifier", simule:false, note:"Dispositif récent, détails non confirmés ici."},
  {id:"malraux", fam:"Immobilier", nom:"Malraux", avantage:"Réduction de 22 % ou 30 %", plafond:"Travaux de 400 000 € sur 4 ans", blocage:"Location 9 ans", risque:"moyen", statut:"ouvert", simule:false, note:"Immeubles en secteur protégé. Hors plafond global."},
  {id:"deficit", fam:"Immobilier", nom:"Déficit foncier", avantage:"Déduction du revenu global", plafond:"10 700 € par an sur le revenu global", blocage:"Location 3 ans après", risque:"moyen", statut:"ouvert", simule:false, note:"Pour propriétaires bailleurs avec travaux."},
  {id:"lmnp", fam:"Immobilier", nom:"LMNP (location meublée)", avantage:"Amortissement qui neutralise les loyers imposables", plafond:"Hors plafonnement", blocage:"Aucun", risque:"moyen", statut:"ouvert", simule:false, note:"Régime réel recommandé. Prélèvements sociaux à 18,6 % depuis 2026."},
  {id:"av", fam:"Épargne", nom:"Assurance-vie", avantage:"Après 8 ans : gains exonérés jusqu'à 4 600 € par an (9 200 € en couple), puis 7,5 %", plafond:"Versements illimités (7,5 % jusqu'à 150 000 €)", blocage:"Aucun, argent disponible", risque:"faible", statut:"ouvert", simule:true, note:"Simulée dans l'onglet Fructifier. Prélèvements sociaux restés à 17,2 %. L'horloge des 8 ans démarre à l'ouverture : ouvrir tôt, même avec peu."},
  {id:"pea", fam:"Épargne", nom:"PEA", avantage:"Après 5 ans : gains exonérés d'impôt, seuls 18,6 % de prélèvements sociaux", plafond:"150 000 € de versements", blocage:"Retrait avant 5 ans = clôture", risque:"moyen", statut:"ouvert", simule:true, note:"Simulé dans l'onglet Fructifier. Actions européennes ou ETF éligibles uniquement."},
  {id:"livrets", fam:"Épargne", nom:"Livret A, LDDS, LEP", avantage:"Intérêts exonérés d'impôt et de prélèvements sociaux", plafond:"22 950 € (A), 12 000 € (LDDS), 10 000 € (LEP)", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:true, note:"Livret A et LDDS à 1,7 %, LEP à 2,5 % pour les revenus modestes. Idéal pour l'épargne de précaution."},
  {id:"cto", fam:"Épargne", nom:"Compte-titres ordinaire", avantage:"Aucun avantage fiscal", plafond:"Aucun", blocage:"Aucun", risque:"moyen", statut:"ouvert", simule:true, note:"Gains taxés à 31,4 % depuis 2026. À utiliser après le PEA et l'assurance-vie."},
  {id:"retraites", fam:"Règles clés", nom:"Abattement de 10 % des retraités", avantage:"Maintenu en 2026", plafond:"Plafonné par foyer", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:false, note:"La suppression envisagée a été abandonnée."},
  {id:"pourboires", fam:"Règles clés", nom:"Exonération des pourboires", avantage:"Exonération d'impôt", plafond:"Dans la limite fixée par la loi", blocage:"Aucun", risque:"faible", statut:"ouvert", simule:false, note:"Prolongée jusqu'en 2028."},
  {id:"plafond", fam:"Règles clés", nom:"Plafond global des niches fiscales", avantage:"Limite les avantages cumulés", plafond:"10 000 € par an et par foyer (18 000 € outre-mer et Sofica)", blocage:"Excédent perdu, non reportable", risque:"faible", statut:"ouvert", simule:true, note:"Dons, PER et déficit foncier sont hors plafond."}
];

if (typeof module !== "undefined") module.exports = {DATA: DATA, AUDIT: AUDIT};
