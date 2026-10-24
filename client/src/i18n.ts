import type { Continent, Lang } from '../../shared/dataset';
import type { Difficulty, ErrorCode, GameMode } from '../../shared/protocol';
import type { Accuracy } from '../../shared/scoring';
import type { StatId } from '../../shared/stats';

interface Strings {
  tagline: string;
  nickname: string;
  nicknamePlaceholder: string;
  createRoom: string;
  joinRoom: string;
  roomCode: string;
  join: string;
  or: string;
  howTo: string;
  room: string;
  invite: string;
  copied: string;
  players: string;
  host: string;
  you: string;
  waitingForHost: string;
  start: string;
  mode: string;
  rounds: string;
  time: string;
  difficulty: string;
  seconds: string;
  modes: Record<GameMode, string>;
  modeHints: Record<GameMode, string>;
  difficulties: Record<Difficulty, string>;
  round: string;
  statName: Record<StatId, string>;
  statQuestion: Record<StatId, string>;
  unit: Record<StatId, string>;
  whichCountry: string;
  continents: Record<Continent, string>;
  searchCountry: string;
  noMatch: string;
  submit: string;
  submitted: string;
  waitingOthers: (answered: number, total: number) => string;
  typeExact: string;
  correctAnswer: string;
  noGuess: string;
  away: (km: number) => string;
  source: string;
  wikiArticle: string;
  next: string;
  nextIn: (s: number) => string;
  finalStandings: string;
  winner: string;
  playAgain: string;
  backToLobby: string;
  leave: string;
  leaveConfirm: string;
  points: string;
  accuracy: Record<Accuracy, string>;
  reconnecting: string;
  errors: Record<ErrorCode | 'network', string>;
}

const hu: Strings = {
  tagline: 'Tippeld meg az országok számait – barátokkal, valós időben.',
  nickname: 'Beceneved',
  nicknamePlaceholder: 'pl. Tomi',
  createRoom: 'Új szoba létrehozása',
  joinRoom: 'Csatlakozás szobához',
  roomCode: 'Szobakód',
  join: 'Belépés',
  or: 'vagy',
  howTo:
    'Minden körben egy ország egy adatát kell megbecsülnöd (népesség, terület, GDP…), vagy a számokból kitalálni, melyik országról van szó. Minél közelebb vagy, annál több pont.',
  room: 'Szoba',
  invite: 'Meghívó küldése',
  copied: 'Link kimásolva!',
  players: 'Játékosok',
  host: 'házigazda',
  you: 'te',
  waitingForHost: 'Várakozás, hogy a házigazda elindítsa a játékot…',
  start: 'Játék indítása',
  mode: 'Játékmód',
  rounds: 'Körök',
  time: 'Idő / kör',
  difficulty: 'Nehézség',
  seconds: 'mp',
  modes: { numeric: 'Számtippelés', reverse: 'Melyik ország?', mixed: 'Vegyes' },
  modeHints: {
    numeric: 'Csúszkával tippeld meg az adott ország adatát.',
    reverse: 'A számokból találd ki az országot.',
    mixed: 'A két mód felváltva.',
  },
  difficulties: { easy: 'Ismert országok', medium: 'Haladó', hard: 'Mind' },
  round: 'Kör',
  statName: {
    population: 'Népesség',
    area: 'Terület',
    density: 'Népsűrűség',
    gdp: 'GDP',
    gdpPerCapita: 'Egy főre jutó GDP',
    lifeExpectancy: 'Várható élettartam',
    highestPoint: 'Legmagasabb pont',
  },
  statQuestion: {
    population: 'Hány lakosa van?',
    area: 'Mekkora a területe?',
    density: 'Mekkora a népsűrűsége?',
    gdp: 'Mekkora a GDP-je?',
    gdpPerCapita: 'Mennyi az egy főre jutó GDP?',
    lifeExpectancy: 'Hány év a születéskor várható élettartam?',
    highestPoint: 'Milyen magas a legmagasabb pontja?',
  },
  unit: {
    population: 'fő',
    area: 'km²',
    density: 'fő/km²',
    gdp: 'USD',
    gdpPerCapita: 'USD',
    lifeExpectancy: 'év',
    highestPoint: 'm',
  },
  whichCountry: 'Melyik országra illenek ezek a számok?',
  continents: {
    africa: 'Afrika',
    asia: 'Ázsia',
    europe: 'Európa',
    'north-america': 'Észak- és Közép-Amerika',
    'south-america': 'Dél-Amerika',
    oceania: 'Óceánia',
  },
  searchCountry: 'Kezdd el gépelni az ország nevét…',
  noMatch: 'Nincs ilyen ország',
  submit: 'Tipp beküldése',
  submitted: 'Tipp elküldve',
  waitingOthers: (a, t) => `Várakozás a többiekre (${a}/${t})`,
  typeExact: 'Pontos szám beírása',
  correctAnswer: 'A helyes válasz',
  noGuess: 'nem tippelt',
  away: (km) => `${km.toLocaleString('hu')} km-re`,
  source: 'Forrás',
  wikiArticle: 'Wikipédia-cikk',
  next: 'Tovább',
  nextIn: (s) => `Következő kör ${s} mp múlva`,
  finalStandings: 'Végeredmény',
  winner: 'Győztes',
  playAgain: 'Új játék',
  backToLobby: 'Vissza a váróba',
  leave: 'Kilépés',
  leaveConfirm: 'Biztosan kilépsz a szobából?',
  points: 'pont',
  accuracy: {
    perfect: 'Telitalálat!',
    great: 'Nagyon közel!',
    good: 'Jó tipp',
    meh: 'Nem rossz',
    miss: 'Mellé',
  },
  reconnecting: 'Kapcsolódás…',
  errors: {
    invalid_nickname: 'Adj meg egy becenevet.',
    room_not_found: 'Nincs ilyen szoba. Ellenőrizd a kódot!',
    room_full: 'A szoba megtelt.',
    game_in_progress: 'A játék már folyamatban van.',
    not_host: 'Ezt csak a házigazda teheti meg.',
    invalid_payload: 'Érvénytelen kérés.',
    not_in_room: 'Nem vagy szobában.',
    server_busy: 'A szerver túlterhelt, próbáld újra később.',
    network: 'Nincs kapcsolat a szerverrel.',
  },
};

const en: Strings = {
  tagline: 'Guess the numbers behind every country – live, with friends.',
  nickname: 'Your nickname',
  nicknamePlaceholder: 'e.g. Tom',
  createRoom: 'Create a room',
  joinRoom: 'Join a room',
  roomCode: 'Room code',
  join: 'Join',
  or: 'or',
  howTo:
    'Each round you estimate a fact about a country (population, area, GDP…) or work out which country a set of numbers belongs to. The closer you are, the more points you get.',
  room: 'Room',
  invite: 'Invite friends',
  copied: 'Link copied!',
  players: 'Players',
  host: 'host',
  you: 'you',
  waitingForHost: 'Waiting for the host to start the game…',
  start: 'Start game',
  mode: 'Game mode',
  rounds: 'Rounds',
  time: 'Time / round',
  difficulty: 'Difficulty',
  seconds: 's',
  modes: { numeric: 'Guess the number', reverse: 'Which country?', mixed: 'Mixed' },
  modeHints: {
    numeric: 'Use the slider to estimate a fact about a country.',
    reverse: 'Work out the country from its numbers.',
    mixed: 'Both modes, taking turns.',
  },
  difficulties: { easy: 'Well-known', medium: 'Advanced', hard: 'All' },
  round: 'Round',
  statName: {
    population: 'Population',
    area: 'Area',
    density: 'Population density',
    gdp: 'GDP',
    gdpPerCapita: 'GDP per capita',
    lifeExpectancy: 'Life expectancy',
    highestPoint: 'Highest point',
  },
  statQuestion: {
    population: 'How many people live here?',
    area: 'How large is it?',
    density: 'How densely populated is it?',
    gdp: 'What is its GDP?',
    gdpPerCapita: 'What is its GDP per capita?',
    lifeExpectancy: 'What is the life expectancy at birth?',
    highestPoint: 'How high is its highest point?',
  },
  unit: {
    population: 'people',
    area: 'km²',
    density: 'people/km²',
    gdp: 'USD',
    gdpPerCapita: 'USD',
    lifeExpectancy: 'years',
    highestPoint: 'm',
  },
  whichCountry: 'Which country do these numbers describe?',
  continents: {
    africa: 'Africa',
    asia: 'Asia',
    europe: 'Europe',
    'north-america': 'North & Central America',
    'south-america': 'South America',
    oceania: 'Oceania',
  },
  searchCountry: 'Start typing a country…',
  noMatch: 'No such country',
  submit: 'Lock in guess',
  submitted: 'Guess locked in',
  waitingOthers: (a, t) => `Waiting for the others (${a}/${t})`,
  typeExact: 'Type an exact number',
  correctAnswer: 'Correct answer',
  noGuess: 'no guess',
  away: (km) => `${km.toLocaleString('en')} km away`,
  source: 'Source',
  wikiArticle: 'Wikipedia article',
  next: 'Next',
  nextIn: (s) => `Next round in ${s}s`,
  finalStandings: 'Final standings',
  winner: 'Winner',
  playAgain: 'Play again',
  backToLobby: 'Back to lobby',
  leave: 'Leave',
  leaveConfirm: 'Leave this room?',
  points: 'pts',
  accuracy: {
    perfect: 'Spot on!',
    great: 'So close!',
    good: 'Good guess',
    meh: 'Not bad',
    miss: 'Missed',
  },
  reconnecting: 'Reconnecting…',
  errors: {
    invalid_nickname: 'Please enter a nickname.',
    room_not_found: 'No room with that code. Check it again!',
    room_full: 'This room is full.',
    game_in_progress: 'The game is already running.',
    not_host: 'Only the host can do that.',
    invalid_payload: 'Invalid request.',
    not_in_room: 'You are not in a room.',
    server_busy: 'The server is busy, try again later.',
    network: 'Cannot reach the server.',
  },
};

export const STRINGS: Record<Lang, Strings> = { hu, en };
export type { Strings };
