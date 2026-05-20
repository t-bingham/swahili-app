export type NounClass = 'M-Wa' | 'M-Mi' | 'Ki-Vi' | 'N' | 'Ma' | 'U';

export interface NounClassInfo {
  label: string;   // short label shown on buttons
  desc: string;    // what kind of things belong here
  sg: string;      // singular noun prefix
  pl: string;      // plural noun prefix
  verbSg: string;  // subject concord singular
  verbPl: string;  // subject concord plural
  example: string; // canonical sg → pl example
}

export const NOUN_CLASS_INFO: Record<NounClass, NounClassInfo> = {
  'M-Wa': {
    label: 'M-Wa',
    desc: 'people & living beings',
    sg: 'm-/mw-', pl: 'wa-',
    verbSg: 'a-', verbPl: 'wa-',
    example: 'mtu → watu',
  },
  'M-Mi': {
    label: 'M-Mi',
    desc: 'plants, trees & rivers',
    sg: 'm-', pl: 'mi-',
    verbSg: 'u-', verbPl: 'i-',
    example: 'mti → miti',
  },
  'Ki-Vi': {
    label: 'Ki-Vi',
    desc: 'things & languages',
    sg: 'ki-/ch-', pl: 'vi-/vy-',
    verbSg: 'ki-', verbPl: 'vi-',
    example: 'kitabu → vitabu',
  },
  'N': {
    label: 'N class',
    desc: 'animals & loanwords',
    sg: 'n-/Ø', pl: 'n-/Ø',
    verbSg: 'i-', verbPl: 'zi-',
    example: 'ndizi → ndizi',
  },
  'Ma': {
    label: 'Ma/Ji-Ma',
    desc: 'liquids, fruits & collectives',
    sg: 'Ø/ji-', pl: 'ma-',
    verbSg: 'li-', verbPl: 'ya-',
    example: 'tunda → matunda',
  },
  'U': {
    label: 'U class',
    desc: 'abstract concepts',
    sg: 'u-', pl: 'Ø/ny-',
    verbSg: 'u-', verbPl: 'zi-',
    example: 'upendo (no plural)',
  },
};

export const ALL_NOUN_CLASSES: NounClass[] = ['M-Wa', 'M-Mi', 'Ki-Vi', 'N', 'Ma', 'U'];

// ─── Word → class map ─────────────────────────────────────────────────────────
// Used by the DB migration to populate cards.noun_class.
// Only include words we're confident about. Add more as the curriculum expands.
export const NOUN_CLASS_MAP: Record<string, NounClass> = {
  // ── M-Wa (people & living beings) ─────────────────────────────────────────
  'mtu': 'M-Wa',        // person
  'mwalimu': 'M-Wa',    // teacher
  'mtoto': 'M-Wa',      // child
  'mke': 'M-Wa',        // wife
  'mume': 'M-Wa',       // husband
  'msichana': 'M-Wa',   // girl
  'mvulana': 'M-Wa',    // boy
  'mzee': 'M-Wa',       // elder
  'mwanafunzi': 'M-Wa', // student
  'mfanyakazi': 'M-Wa', // worker
  'mgeni': 'M-Wa',      // guest, stranger
  'mpishi': 'M-Wa',     // cook
  'mwandishi': 'M-Wa',  // writer
  'mkulima': 'M-Wa',    // farmer
  'mwimbaji': 'M-Wa',   // singer
  'mhusika': 'M-Wa',    // character (person)
  'msaidizi': 'M-Wa',   // helper, assistant
  'mfuasi': 'M-Wa',     // follower
  'mwenzako': 'M-Wa',   // your companion

  // ── M-Mi (plants, trees, rivers, some body parts) ─────────────────────────
  'mti': 'M-Mi',        // tree
  'mto': 'M-Mi',        // river
  'mji': 'M-Mi',        // town, city
  'mkono': 'M-Mi',      // hand, arm
  'mguu': 'M-Mi',       // leg, foot
  'moyo': 'M-Mi',       // heart
  'mwaka': 'M-Mi',      // year
  'mwezi': 'M-Mi',      // month, moon
  'mlango': 'M-Mi',     // door
  'mwili': 'M-Mi',      // body
  'msitu': 'M-Mi',      // forest
  'mzigo': 'M-Mi',      // load, luggage
  'mkoba': 'M-Mi',      // bag
  'mstari': 'M-Mi',     // line, row
  'mwanga': 'M-Mi',     // light
  'mchoro': 'M-Mi',     // drawing, sketch
  'mzunguko': 'M-Mi',   // cycle, orbit
  'mfumo': 'M-Mi',      // system, framework
  'mchakato': 'M-Mi',   // process

  // ── Ki-Vi (things, languages, tools) ──────────────────────────────────────
  'kitabu': 'Ki-Vi',    // book
  'kitu': 'Ki-Vi',      // thing
  'chakula': 'Ki-Vi',   // food (ch- = ki- before a)
  'kiti': 'Ki-Vi',      // chair
  'kisu': 'Ki-Vi',      // knife
  'kidole': 'Ki-Vi',    // finger, toe
  'kijiji': 'Ki-Vi',    // village
  'kiswahili': 'Ki-Vi', // Swahili language
  'kingereza': 'Ki-Vi', // English language
  'kikapu': 'Ki-Vi',    // basket
  'kipande': 'Ki-Vi',   // piece, portion
  'kiazi': 'Ki-Vi',     // potato
  'kichwa': 'Ki-Vi',    // head
  'kisima': 'Ki-Vi',    // well (water)
  'kioo': 'Ki-Vi',      // mirror, glass
  'kikombe': 'Ki-Vi',   // cup
  'kijiko': 'Ki-Vi',    // spoon
  'kifurushi': 'Ki-Vi', // parcel, package
  'kiroboto': 'Ki-Vi',  // flea
  'kifaa': 'Ki-Vi',     // tool, device
  'kiolezo': 'Ki-Vi',   // template, pattern
  'kifungo': 'Ki-Vi',   // button, lock
  'choo': 'Ki-Vi',      // toilet (ch- = ki-)
  'chumba': 'Ki-Vi',    // room (ch- = ki-)
  'chombo': 'Ki-Vi',    // vessel, tool (ch- = ki-)

  // ── N class (animals, loanwords, some uncountables) ───────────────────────
  'nyumba': 'N',        // house
  'nchi': 'N',          // country, land
  'siku': 'N',          // day
  'njia': 'N',          // road, way, path
  'ndizi': 'N',         // banana
  'mbwa': 'N',          // dog
  'paka': 'N',          // cat
  'nguo': 'N',          // clothes
  'shule': 'N',         // school
  'mama': 'N',          // mother
  'baba': 'N',          // father
  'simu': 'N',          // phone
  'gari': 'N',          // car
  'ndege': 'N',         // bird, airplane
  'samaki': 'N',        // fish
  'simba': 'N',         // lion
  'tembo': 'N',         // elephant
  'kondoo': 'N',        // sheep
  'kuku': 'N',          // chicken
  'ngombe': 'N',        // cow
  'farasi': 'N',        // horse
  'njiwa': 'N',         // pigeon, dove
  'nyoka': 'N',         // snake
  'rafiki': 'N',        // friend
  'basi': 'N',          // bus
  'daktari': 'N',       // doctor (loanword)
  'dereva': 'N',        // driver (loanword)
  'polisi': 'N',        // police (loanword)
  'hospitali': 'N',     // hospital (loanword)
  'saa': 'N',           // clock, hour
  'habari': 'N',        // news, information
  'kazi': 'N',          // work
  'pesa': 'N',          // money
  'nyota': 'N',         // star
  'nywele': 'N',        // hair
  'nguruwe': 'N',       // pig
  'mamba': 'N',         // crocodile
  'nyani': 'N',         // monkey
  'mbegu': 'N',         // seed
  'pembe': 'N',         // corner, horn
  'kalamu': 'N',        // pen (loanword from Arabic)
  'karatasi': 'N',      // paper (loanword)
  'sanduku': 'N',       // box, suitcase
  'sufuria': 'N',       // cooking pot
  'sahani': 'N',        // plate, dish

  // ── Ma/Ji-Ma (liquids, fruits, augmentatives, collectives) ────────────────
  'maji': 'Ma',         // water (mass noun, Ma class base)
  'jina': 'Ma',         // name (jina → majina)
  'jibu': 'Ma',         // answer (jibu → majibu)
  'jicho': 'Ma',        // eye (jicho → macho)
  'tunda': 'Ma',        // fruit (tunda → matunda)
  'embe': 'Ma',         // mango (embe → maembe)
  'ua': 'Ma',           // flower (ua → maua)
  'duka': 'Ma',         // shop (duka → maduka)
  'darasa': 'Ma',       // classroom (darasa → madarasa)
  'kosa': 'Ma',         // mistake (kosa → makosa)
  'dirisha': 'Ma',      // window (dirisha → madirisha)
  'neno': 'Ma',         // word (neno → maneno)
  'goti': 'Ma',         // knee (goti → magoti)
  'bega': 'Ma',         // shoulder (bega → mabega)
  'tangazo': 'Ma',      // announcement (tangazo → matangazo)
  'shauri': 'Ma',       // matter, affair (shauri → mashauri)
  'swali': 'Ma',        // question (swali → maswali)
  'ombi': 'Ma',         // request (ombi → maombi)
  'wazo': 'Ma',         // idea, thought (wazo → mawazo)
  'penzi': 'Ma',        // love, affection (penzi → mapenzi)
  'zoea': 'Ma',         // habit (zoea → mazoea)

  // ── U class (abstract concepts, long thin things) ─────────────────────────
  'upendo': 'U',        // love (no plural)
  'uhuru': 'U',         // freedom (no plural)
  'urafiki': 'U',       // friendship (no plural)
  'uwezo': 'U',         // ability (no plural)
  'ugonjwa': 'U',       // illness (ugonjwa → magonjwa)
  'uso': 'U',           // face (uso → nyuso)
  'ukuta': 'U',         // wall (ukuta → kuta)
  'ujumbe': 'U',        // message (ujumbe → mijumbe)
  'usiku': 'U',         // night
  'uzuri': 'U',         // beauty (no plural)
  'umuhimu': 'U',       // importance (no plural)
  'uelewa': 'U',        // understanding (no plural)
  'utamaduni': 'U',     // culture, tradition
  'ujuzi': 'U',         // skill, expertise
};
