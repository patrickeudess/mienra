// Rappels WhatsApp : normalisation du numéro pour les liens wa.me.
// L'indicatif ivoirien (225) est préfixé si absent ; les numéros vides ou
// trop courts ne produisent pas de lien (bouton masqué côté UI).
module.exports = (app, t) => {
  const { whatsappNumber } = app;

  // Numéro local ivoirien à 10 chiffres → préfixe 225, chiffres conservés.
  t.eq(whatsappNumber("07 07 70 44 54"), "2250707704454", "wa: numéro local espacé → 225 + chiffres");
  t.eq(whatsappNumber("0707704454"), "2250707704454", "wa: numéro local compact → 225 + chiffres");
  t.eq(whatsappNumber("07-07-70-44-54"), "2250707704454", "wa: séparateurs ignorés");

  // Déjà international → inchangé (indicatif non redoublé).
  t.eq(whatsappNumber("+225 07 07 70 44 54"), "2250707704454", "wa: format +225 → indicatif non redoublé");
  t.eq(whatsappNumber("2250707704454"), "2250707704454", "wa: déjà préfixé 225 → inchangé");

  // Entrées non exploitables → chaîne vide (pas de lien).
  t.eq(whatsappNumber(""), "", "wa: vide → pas de numéro");
  t.eq(whatsappNumber(null), "", "wa: null → pas de numéro");
  t.eq(whatsappNumber("12345"), "", "wa: trop court → pas de numéro");
  t.eq(whatsappNumber("téléphone : néant"), "", "wa: texte sans chiffres → pas de numéro");
};
