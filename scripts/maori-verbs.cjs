/**
 * High-frequency Te Reo Māori verbs and stative adjectives, with metadata used
 * by the tense-pattern generator (maori-tense.cjs).
 *
 * Te reo does NOT inflect verbs — tense is marked by particles BEFORE the verb
 * (kei te, kua, ka, i, e/ana). So the "conjugation multiplier" the Korean script
 * uses (~13 forms per verb) is here a "particle multiplier" (~6 forms per verb).
 *
 * Field guide:
 *   base   — the bare verb form
 *   en     — English gloss in dictionary form ("to go", "to be big")
 *   pron   — light pronunciation guide
 *   unit   — target unit id
 *   pos    — 'verb' or 'adjective' (statives — used directly with "He ___")
 *   passive (optional) — passive form ending (most Māori verbs have one)
 */
module.exports.VERBS = [
  // Motion / location
  { base: 'haere',        en: 'to go',             pron: 'HAI-reh',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'hoki',         en: 'to return',         pron: 'HOH-kee',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'tae',          en: 'to arrive',         pron: 'TAH-eh',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'wehe',         en: 'to leave',          pron: 'WEH-heh',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'oma',          en: 'to run',            pron: 'OH-mah',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'hīkoi',        en: 'to walk',           pron: 'HEE-koy',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'eke',          en: 'to climb / board',  pron: 'EH-keh',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'rere',         en: 'to fly / flow',     pron: 'REH-reh',          unit: 'mi-unit-16', pos: 'verb' },
  { base: 'kau',          en: 'to swim',           pron: 'KOW',              unit: 'mi-unit-16', pos: 'verb' },
  { base: 'noho',         en: 'to sit / stay',     pron: 'NOH-hoh',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'tū',           en: 'to stand',          pron: 'TOO',              unit: 'mi-unit-06', pos: 'verb' },
  { base: 'takoto',       en: 'to lie down',       pron: 'TAH-koh-toh',      unit: 'mi-unit-06', pos: 'verb' },

  // Eating / drinking / sleeping
  { base: 'kai',          en: 'to eat',            pron: 'KIGH',             unit: 'mi-unit-06', pos: 'verb' },
  { base: 'inu',          en: 'to drink',          pron: 'EE-noo',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'moe',          en: 'to sleep',          pron: 'MOH-eh',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'ara',          en: 'to wake up',        pron: 'AH-rah',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'tunu',         en: 'to cook',           pron: 'TOO-noo',          unit: 'mi-unit-05', pos: 'verb' },
  { base: 'horoi',        en: 'to wash',           pron: 'HOH-roy',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'kakahu',       en: 'to dress',          pron: 'KAH-kah-hoo',      unit: 'mi-unit-06', pos: 'verb' },

  // Speech / cognition
  { base: 'kōrero',       en: 'to speak / talk',   pron: 'KOH-reh-roh',      unit: 'mi-unit-06', pos: 'verb' },
  { base: 'pātai',        en: 'to ask',            pron: 'PAH-tai',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'whakahoki',    en: 'to reply',          pron: 'FAH-kah-HOH-kee',  unit: 'mi-unit-06', pos: 'verb' },
  { base: 'whakarongo',   en: 'to listen',         pron: 'FAH-kah-ROH-ngoh', unit: 'mi-unit-06', pos: 'verb' },
  { base: 'titiro',       en: 'to look',           pron: 'TEE-tee-roh',      unit: 'mi-unit-06', pos: 'verb' },
  { base: 'kite',         en: 'to see',            pron: 'KEE-teh',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'rongo',        en: 'to hear / feel',    pron: 'ROH-ngoh',         unit: 'mi-unit-06', pos: 'verb' },
  { base: 'mōhio',        en: 'to know',           pron: 'MOH-hee-oh',       unit: 'mi-unit-06', pos: 'verb' },
  { base: 'mahara',       en: 'to remember',       pron: 'MAH-hah-rah',      unit: 'mi-unit-06', pos: 'verb' },
  { base: 'wareware',     en: 'to forget',         pron: 'WAH-reh-WAH-reh',  unit: 'mi-unit-06', pos: 'verb' },
  { base: 'whakaaro',     en: 'to think',          pron: 'FAH-kah-AH-roh',   unit: 'mi-unit-06', pos: 'verb' },
  { base: 'mārama',       en: 'to understand',     pron: 'MAH-rah-mah',      unit: 'mi-unit-06', pos: 'verb' },
  { base: 'akiaki',       en: 'to encourage',      pron: 'AH-kee-AH-kee',    unit: 'mi-unit-06', pos: 'verb' },
  { base: 'ako',          en: 'to learn / teach',  pron: 'AH-koh',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'whakaako',     en: 'to teach',          pron: 'FAH-kah-AH-koh',   unit: 'mi-unit-06', pos: 'verb' },
  { base: 'pānui',        en: 'to read',           pron: 'PAH-noo-ee',       unit: 'mi-unit-06', pos: 'verb' },
  { base: 'tuhi',         en: 'to write',          pron: 'TOO-hee',          unit: 'mi-unit-06', pos: 'verb' },

  // Feeling
  { base: 'aroha',        en: 'to love',           pron: 'AH-roh-hah',       unit: 'mi-unit-06', pos: 'verb' },
  { base: 'hiahia',       en: 'to want',           pron: 'HEE-ah-HEE-ah',    unit: 'mi-unit-06', pos: 'verb' },
  { base: 'kata',         en: 'to laugh',          pron: 'KAH-tah',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'tangi',        en: 'to cry / mourn',    pron: 'TAH-ngee',         unit: 'mi-unit-06', pos: 'verb' },
  { base: 'mataku',       en: 'to fear',           pron: 'MAH-tah-koo',      unit: 'mi-unit-06', pos: 'verb' },
  { base: 'whakahihiko',  en: 'to inspire',        pron: 'FAH-kah-HEE-hee-koh', unit: 'mi-unit-06', pos: 'verb' },

  // Action / work
  { base: 'mahi',         en: 'to work / do',      pron: 'MAH-hee',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'tīmata',       en: 'to begin',          pron: 'TEE-mah-tah',      unit: 'mi-unit-06', pos: 'verb' },
  { base: 'mutu',         en: 'to finish',         pron: 'MOO-too',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'oti',          en: 'to be completed',   pron: 'OH-tee',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'hanga',        en: 'to build',          pron: 'HAH-ngah',         unit: 'mi-unit-06', pos: 'verb' },
  { base: 'whakatika',    en: 'to fix / correct',  pron: 'FAH-kah-TEE-kah',  unit: 'mi-unit-06', pos: 'verb' },
  { base: 'whakapai',     en: 'to make good',      pron: 'FAH-kah-PIE',      unit: 'mi-unit-06', pos: 'verb' },
  { base: 'whakakī',      en: 'to fill',           pron: 'FAH-kah-KEE',      unit: 'mi-unit-06', pos: 'verb' },
  { base: 'patu',         en: 'to strike',         pron: 'PAH-too',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'tiki',         en: 'to fetch',          pron: 'TEE-kee',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'mau',          en: 'to hold / wear',    pron: 'MAH-oo',           unit: 'mi-unit-06', pos: 'verb' },
  { base: 'tuku',         en: 'to send / release', pron: 'TOO-koo',          unit: 'mi-unit-06', pos: 'verb' },
  { base: 'utu',          en: 'to pay',            pron: 'OO-too',           unit: 'mi-unit-21', pos: 'verb' },
  { base: 'hoko',         en: 'to buy / sell',     pron: 'HOH-koh',          unit: 'mi-unit-06', pos: 'verb' },

  // Cultural / ceremonial
  { base: 'mihi',         en: 'to greet',          pron: 'MEE-hee',          unit: 'mi-unit-23', pos: 'verb' },
  { base: 'karakia',      en: 'to recite a prayer', pron: 'KAH-rah-KEE-ah',  unit: 'mi-unit-23', pos: 'verb' },
  { base: 'waiata',       en: 'to sing',           pron: 'WHY-ah-tah',       unit: 'mi-unit-23', pos: 'verb' },
  { base: 'haka',         en: 'to perform haka',   pron: 'HAH-kah',          unit: 'mi-unit-09', pos: 'verb' },
  { base: 'hongi',        en: 'to press noses',    pron: 'HOH-ngee',         unit: 'mi-unit-09', pos: 'verb' },
  { base: 'pōwhiri',      en: 'to welcome ceremonially', pron: 'POH-fee-ree', unit: 'mi-unit-09', pos: 'verb' },
  { base: 'manaaki',      en: 'to care for / host', pron: 'MAH-nah-AH-kee',  unit: 'mi-unit-12', pos: 'verb' },
  { base: 'tiaki',        en: 'to guard / care for', pron: 'TEE-ah-kee',     unit: 'mi-unit-12', pos: 'verb' },

  // Statives (adjectives) — used directly with "He ___"
  { base: 'pai',          en: 'to be good',        pron: 'PIE',              unit: 'mi-unit-06', pos: 'adjective' },
  { base: 'kino',         en: 'to be bad',         pron: 'KEE-noh',          unit: 'mi-unit-06', pos: 'adjective' },
  { base: 'nui',          en: 'to be big',         pron: 'NOO-ee',           unit: 'mi-unit-06', pos: 'adjective' },
  { base: 'iti',          en: 'to be small',       pron: 'EE-tee',           unit: 'mi-unit-06', pos: 'adjective' },
  { base: 'roa',          en: 'to be long',        pron: 'ROH-ah',           unit: 'mi-unit-14', pos: 'adjective' },
  { base: 'poto',         en: 'to be short',       pron: 'POH-toh',          unit: 'mi-unit-14', pos: 'adjective' },
  { base: 'hou',          en: 'to be new',         pron: 'HOH',              unit: 'mi-unit-14', pos: 'adjective' },
  { base: 'wera',         en: 'to be hot',         pron: 'WEH-rah',          unit: 'mi-unit-14', pos: 'adjective' },
  { base: 'mātao',        en: 'to be cold',        pron: 'MAH-tah-oh',       unit: 'mi-unit-14', pos: 'adjective' },
  { base: 'reka',         en: 'to be delicious',   pron: 'REH-kah',          unit: 'mi-unit-06', pos: 'adjective' },
  { base: 'ātaahua',      en: 'to be beautiful',   pron: 'AH-tah-AH-hoo-ah', unit: 'mi-unit-14', pos: 'adjective' },
  { base: 'kaha',         en: 'to be strong',      pron: 'KAH-hah',          unit: 'mi-unit-17', pos: 'adjective' },
  { base: 'māmā',         en: 'to be easy',        pron: 'MAH-MAH',          unit: 'mi-unit-06', pos: 'adjective' },
  { base: 'uaua',         en: 'to be difficult',   pron: 'OO-ah-OO-ah',      unit: 'mi-unit-06', pos: 'adjective' },
  { base: 'koa',          en: 'to be happy',       pron: 'KOH-ah',           unit: 'mi-unit-17', pos: 'adjective' },
  { base: 'pōuri',        en: 'to be sad',         pron: 'POH-oo-ree',       unit: 'mi-unit-17', pos: 'adjective' },
  { base: 'riri',         en: 'to be angry',       pron: 'REE-ree',          unit: 'mi-unit-17', pos: 'adjective' },
  { base: 'māuiui',       en: 'to be tired / sick', pron: 'MAH-oo-ee-OO-ee', unit: 'mi-unit-22', pos: 'adjective' },
  { base: 'hiakai',       en: 'to be hungry',      pron: 'HEE-ah-kigh',      unit: 'mi-unit-05', pos: 'adjective' },
  { base: 'hiainu',       en: 'to be thirsty',     pron: 'HEE-ah-EE-noo',    unit: 'mi-unit-05', pos: 'adjective' },
];
