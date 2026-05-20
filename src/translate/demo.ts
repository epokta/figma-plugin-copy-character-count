// Demo translation provider — uses a small hard-coded dictionary so the UX is
// testable without an external API. Per the PRD, real providers (DeepL, Google,
// OpenAI) implement the same TranslationProvider interface and slot in here.
//
// Strategy:
//   1. Exact phrase match against the dictionary first.
//   2. Word-by-word fallback (with case preserved on word boundaries).
//   3. Unknown words pass through unchanged (covers proper nouns, brand names,
//      numbers, abbreviations like "HND" or "11:30 PM").

import { TargetLang, Translation } from '../types';
import { TranslationProvider } from './provider';

// Phrase- and word-level mappings. Lower-cased keys; lookups are case-insensitive
// and we restore the original word's case in the output.
const dict: Record<TargetLang, Record<string, string>> = {
  de: {
    // Common UI words
    open: 'offen',
    closed: 'geschlossen',
    welcome: 'willkommen',
    hello: 'hallo',
    search: 'suche',
    until: 'bis',
    more: 'mehr',
    home: 'startseite',
    membership: 'mitgliedschaft',
    concierge: 'concierge',
    benefits: 'vorteile',
    all: 'alle',
    international: 'international',
    domestic: 'inland',
    'view more': 'mehr anzeigen',
    'sign up': 'registrieren',
    'log in': 'anmelden',
    settings: 'einstellungen',
    cancel: 'abbrechen',
    save: 'speichern',
    edit: 'bearbeiten',
    delete: 'löschen',
    next: 'weiter',
    back: 'zurück',
    continue: 'weiter',
    // Phrases specific to the travel-app demo screen
    'welcome to tripguide': 'Willkommen bei Tripguide',
    'hello, emilia': 'Hallo, Emilia',
    'sky lounge': 'Sky Lounge',
    'plaza premier': 'Plaza Premier',
    'fast track': 'Schnellspur',
    'hnd terminal 1': 'HND Terminal 1',
    'hnd terminal 3': 'HND Terminal 3',
    'hnd terminal 4': 'HND Terminal 4',
    'until 11:30 pm': 'Bis 23:30 Uhr',
    'until 11:30': 'Bis 23:30',
    'search by lounges, airport, city':
      'Suche nach Lounges, Flughäfen, Städten',
  },
  es: {
    open: 'abierto',
    closed: 'cerrado',
    welcome: 'bienvenido',
    hello: 'hola',
    search: 'buscar',
    until: 'hasta',
    more: 'más',
    home: 'inicio',
    membership: 'membresía',
    concierge: 'conserjería',
    benefits: 'beneficios',
    all: 'todos',
    international: 'internacional',
    domestic: 'nacional',
    'view more': 'ver más',
    'sign up': 'registrarse',
    'log in': 'iniciar sesión',
    settings: 'ajustes',
    cancel: 'cancelar',
    save: 'guardar',
    edit: 'editar',
    delete: 'eliminar',
    next: 'siguiente',
    back: 'atrás',
    continue: 'continuar',
    'welcome to tripguide': 'Bienvenido a Tripguide',
    'hello, emilia': 'Hola, Emilia',
    'sky lounge': 'Sky Lounge',
    'plaza premier': 'Plaza Premier',
    'fast track': 'Vía Rápida',
    'hnd terminal 1': 'Terminal 1 HND',
    'hnd terminal 3': 'Terminal 3 HND',
    'hnd terminal 4': 'Terminal 4 HND',
    'until 11:30 pm': 'Hasta las 11:30 PM',
    'search by lounges, airport, city':
      'Busca por salas, aeropuerto, ciudad',
  },
  ar: {
    open: 'مفتوح',
    closed: 'مغلق',
    welcome: 'مرحبا',
    hello: 'مرحبا',
    search: 'بحث',
    until: 'حتى',
    more: 'المزيد',
    home: 'الرئيسية',
    membership: 'العضوية',
    concierge: 'الكونسيرج',
    benefits: 'المزايا',
    all: 'الكل',
    international: 'دولي',
    domestic: 'محلي',
    'view more': 'عرض المزيد',
    'sign up': 'التسجيل',
    'log in': 'تسجيل الدخول',
    settings: 'الإعدادات',
    cancel: 'إلغاء',
    save: 'حفظ',
    edit: 'تعديل',
    delete: 'حذف',
    next: 'التالي',
    back: 'رجوع',
    continue: 'متابعة',
    'welcome to tripguide': 'مرحبًا بك في Tripguide',
    'hello, emilia': 'مرحبا، إميليا',
    'sky lounge': 'صالة سكاي',
    'plaza premier': 'بلازا بريمير',
    'fast track': 'المسار السريع',
    'hnd terminal 1': 'مبنى HND رقم 1',
    'hnd terminal 3': 'مبنى HND رقم 3',
    'hnd terminal 4': 'مبنى HND رقم 4',
    'until 11:30 pm': 'حتى 11:30 مساءً',
    'search by lounges, airport, city':
      'ابحث حسب الصالات والمطار والمدينة',
  },
};

function restoreCase(template: string, translated: string): string {
  if (template.length === 0) return translated;
  if (template.toUpperCase() === template) return translated.toUpperCase();
  if (template[0] === template[0].toUpperCase()) {
    return translated[0].toUpperCase() + translated.slice(1);
  }
  return translated;
}

function translateWord(word: string, target: TargetLang): string {
  const lower = word.toLowerCase();
  const hit = dict[target][lower];
  if (!hit) return word; // unknown → pass through
  return restoreCase(word, hit);
}

function translateOne(source: string, target: TargetLang): string {
  const trimmed = source.trim();
  if (!trimmed) return source;

  // 1) exact-phrase match (case-insensitive). Restore the input's case onto
  //    the dictionary value so "Open" -> "Offen" (not "offen") for entries
  //    stored as lowercase singletons.
  const phraseHit = dict[target][trimmed.toLowerCase()];
  if (phraseHit) return restoreCase(trimmed, phraseHit);

  // 2) word-by-word fallback. Preserve internal whitespace + punctuation.
  return source.replace(/\b[\p{L}\p{M}']+\b/gu, (match) =>
    translateWord(match, target)
  );
}

export const demoProvider: TranslationProvider = {
  async translate(strings, targetLang) {
    // Simulate a small network delay so the in-flight UI state is visible.
    await new Promise((resolve) => setTimeout(resolve, 250));
    return strings.map((source) => ({
      source,
      translation: translateOne(source, targetLang),
    }));
  },
};
