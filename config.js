// Horizon : réglages. Tu peux modifier ce fichier sans toucher au reste.
window.HORIZON_CONFIG = {
  // Port du service local (service/service.js).
  servicePort: 8097,

  // Fonds d'écran : durée d'affichage de chaque photo et durée du fondu, en secondes.
  wallpaperSeconds: 60,
  fadeSeconds: 2.5,

  // Après ce délai sans toucher la télécommande, le dock s'efface (mode ambiance).
  idleSeconds: 90,

  // Dock par défaut, dans l'ordre (recherche dans le nom de l'appli, sans tenir compte
  // des majuscules ni des accents). Modifiable ensuite sur la TV : maintenir OK sur une appli.
  defaultDock: ['canal', 'tizentube', 'netflix', 'prime video', 'disney', 'youtube', 'stremio', 'france', 'spotify'],

  // Applis masquées par défaut dans « Toutes les applis » (réaffichables sur la TV).
  hiddenByDefault: ['tv plus', 'workspace', 'gaming hub', 'samsung health', 'workout', 'e-manual', 'tizenbrew'],

  // Photos nature : « images remarquables » de Wikimedia Commons, chargées par la TV.
  // file = nom exact du fichier sur Commons ; place = légende affichée.
  wallpapers: [
    { file: '1 lake louise pano 2019.jpg', place: 'Lac Louise, Canada' },
    { file: '2015 Spullersee im Lechquellengebirge.jpg', place: 'Spullersee, Autriche' },
    { file: 'Blue Lake in Mount Cook National Park.jpg', place: 'Blue Lake, parc national du mont Cook, Nouvelle-Zélande' },
    { file: 'Gokyo Ri summit, Gokyo Lake, Nepal, Himalayas.jpg', place: 'Lac de Gokyo, Himalaya, Népal' },
    { file: 'Golden Hour at Emerald Bay.jpg', place: 'Emerald Bay à l’heure dorée, lac Tahoe' },
    { file: 'Lac de Montriond 06.jpg', place: 'Lac de Montriond, Haute-Savoie' },
    { file: 'Lac des Mines d\'Or 02.jpg', place: 'Lac des Mines d’Or, Haute-Savoie' },
    { file: 'Lago Bernard, Columbia Británica, Canadá, 2017-08-26, DD 68-75 PAN.jpg', place: 'Lac Bernard, Colombie-Britannique' },
    { file: 'Lago Kluane, Destruction Bay, Yukón, Canadá, 2017-08-25, DD 70-76 PAN.jpg', place: 'Lac Kluane, Yukon' },
    { file: 'Lake Mystery, Canterbury, New Zealand 05.jpg', place: 'Lake Mystery, Canterbury, Nouvelle-Zélande' },
    { file: 'Lake Tekapo 01.jpg', place: 'Lac Tekapo, Nouvelle-Zélande' },
    { file: 'Massif du Mont-Blanc from Lac de Joux Plane 03.jpg', place: 'Massif du Mont-Blanc depuis le lac de Joux Plane' },
    { file: 'Gentau Pic du Midi Ossau.jpg', place: 'Lac de Gentau et pic du Midi d’Ossau, Pyrénées' },
    { file: 'Bontecou Lake Milky Way panorama.jpg', place: 'Voie lactée sur le lac Bontecou' },
    { file: 'Hommikune udu Kakerdaja rabas.jpg', place: 'Brume du matin, tourbière de Kakerdaja, Estonie' },
    { file: 'Lago Fallère, Valle d\'Aosta (2415m) 002.jpg', place: 'Lac Fallère, vallée d’Aoste' },
    { file: 'Lake Willoughby October 2021 003.jpg', place: 'Lac Willoughby en octobre, Vermont' },
    { file: 'Gull Lake Mammoth September 2016 panorama.jpg', place: 'Gull Lake, Sierra Nevada' },
    { file: 'June Lake Mammoth September 2016 panorama.jpg', place: 'June Lake, Sierra Nevada' },
    { file: 'East End of Rundle and Whitemans Pond.jpg', place: 'Mont Rundle et Whiteman’s Pond, Rocheuses canadiennes' }
  ],

  // Largeur demandée à Wikimedia (1920 = Full HD, léger et net sur la TV).
  wallpaperWidth: 1920
};
