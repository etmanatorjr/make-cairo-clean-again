/* ==========================================================================
   data.js — all the facts, quiz questions, game items and sources.
   The facts are written EXACTLY as in my research.
   ========================================================================== */
var DATA = (function () {
  'use strict';

  // ----- My facts (used on the Air and Waste screens and in the quiz) -----
  var FACTS = {
    pm2025: "Cairo's 2025 average PM2.5 was about 40.8 µg/m³, around 8x the WHO limit of 5.",
    pmHealth: 'PM2.5 gets deep into the lungs and blood, causing heart and lung disease.',
    pmChart: 'WHO safe limit 5, Cairo 2024 39.9, Cairo 2025 40.8 (µg/m³).',
    causes: 'Causes: cars, factories, burning waste, dust, urbanization.',
    wasteAmount: 'Egypt makes about 28 million tonnes of city waste a year, around 40% from Cairo.',
    wasteWhere: 'Around 88% goes to open dumps and only about 7% reaches proper landfills.',
    recycling: 'Recycling went from 10% in 2018 to 37% in 2024. The goal is to have 60% by 2027.',
    solutions: 'Better garbage truck routes and bringing informal collectors like the Zabbaleen into the system.',
    sdg: 'SDG 11.6 is about cutting the harm cities do to the environment, especially air quality and waste.'
  };

  // ----- Quiz bank: each round picks 10 of these in a random order -----
  // "a" is always the right answer here; the answers are shuffled before showing.
  var QUIZ = [
    { q: "What was Cairo's average PM2.5 in 2025?", a: 'About 40.8 µg/m³', wrong: ['About 5 µg/m³', 'About 15 µg/m³', 'About 100 µg/m³'], fact: FACTS.pm2025 },
    { q: 'What is the WHO safe limit for PM2.5?', a: '5 µg/m³', wrong: ['40.8 µg/m³', '25 µg/m³', '100 µg/m³'], fact: FACTS.pm2025 },
    { q: "Cairo's PM2.5 is about how many times the WHO limit?", a: 'About 8x', wrong: ['About 2x', 'The same', 'About 20x'], fact: FACTS.pm2025 },
    { q: 'Why is PM2.5 dangerous?', a: 'It gets deep into the lungs and blood', wrong: ['It only smells bad', 'It only hurts plants', 'It makes the sky blue'], fact: FACTS.pmHealth },
    { q: "What was Cairo's average PM2.5 in 2024?", a: '39.9 µg/m³', wrong: ['5 µg/m³', '12.5 µg/m³', '88 µg/m³'], fact: FACTS.pmChart },
    { q: 'Which one is a cause of air pollution in Cairo?', a: 'Burning waste', wrong: ['Planting trees', 'Riding a bike', 'Solar panels'], fact: FACTS.causes },
    { q: 'How much city waste does Egypt make a year?', a: 'About 28 million tonnes', wrong: ['About 2 million tonnes', 'About 280 million tonnes', 'About 1 million tonnes'], fact: FACTS.wasteAmount },
    { q: "About how much of Egypt's city waste comes from Cairo?", a: 'Around 40%', wrong: ['Around 5%', 'Around 75%', 'All of it'], fact: FACTS.wasteAmount },
    { q: 'Where does around 88% of the waste go?', a: 'Open dumps', wrong: ['Proper landfills', 'Recycling plants', 'Other countries'], fact: FACTS.wasteWhere },
    { q: 'How much waste reaches proper landfills?', a: 'Only about 7%', wrong: ['About 50%', 'About 88%', 'All of it'], fact: FACTS.wasteWhere },
    { q: "What was Egypt's recycling rate in 2024?", a: '37%', wrong: ['10%', '60%', '88%'], fact: FACTS.recycling },
    { q: "What is Egypt's recycling goal for 2027?", a: '60%', wrong: ['37%', '10%', '100%'], fact: FACTS.recycling },
    { q: 'Who are the Zabbaleen?', a: "Cairo's informal waste collectors", wrong: ['A metro line', 'A kind of plastic', 'A football team'], fact: FACTS.solutions },
    { q: 'Which idea helps fix waste in Cairo?', a: 'Better garbage truck routes', wrong: ['Burning trash at night', 'More open dumps', 'Throwing trash in the Nile'], fact: FACTS.solutions },
    { q: 'SDG 11.6 is about which two things?', a: 'Air quality and waste', wrong: ['Football and music', 'Phones and games', 'Food and clothes'], fact: FACTS.sdg }
  ];
  var QUIZ_LENGTH = 10;

  // ----- Trash for the sorting game -----
  var TRASH = [
    { label: 'Plastic bottle', icon: 't-bottle', bin: 'plastic' },
    { label: 'Plastic bag', icon: 't-bag', bin: 'plastic' },
    { label: 'Plastic cup', icon: 't-cup', bin: 'plastic' },
    { label: 'Newspaper', icon: 't-news', bin: 'paper' },
    { label: 'Cardboard', icon: 't-box', bin: 'paper' },
    { label: 'Paper sheet', icon: 't-sheet', bin: 'paper' },
    { label: 'Soda can', icon: 't-can', bin: 'metal' },
    { label: 'Food tin', icon: 't-tin', bin: 'metal' },
    { label: 'Banana peel', icon: 't-banana', bin: 'organic' },
    { label: 'Apple core', icon: 't-apple', bin: 'organic' },
    { label: 'Leaves', icon: 't-leaf', bin: 'organic' }
  ];

  // ----- Take Action: the 3 real actions -----
  var ACTIONS = [
    { id: 'recycle', name: 'Recycle', desc: 'Sort plastic, paper and metal. Give them to collectors.', icon: 'i-recycle' },
    { id: 'metro', name: 'Take the metro', desc: 'Metro or bus, not a car. Less smoke in the air.', icon: 'i-train' },
    { id: 'noburn', name: "Don't burn trash", desc: 'Burning waste makes PM2.5. Bag it instead.', icon: 'i-noburn' }
  ];

  // ----- AQI levels (US AQI scale used by Open-Meteo) with a tip for the day -----
  var AQI_LEVELS = [
    { max: 50, name: 'Good', color: '#4CAF50', tip: 'Clean air today. Walk or bike!' },
    { max: 100, name: 'OK', color: '#F4D03F', tip: 'Take the metro today to keep the air clean.' },
    { max: 150, name: 'Bad for some', color: '#F39C12', tip: 'Take the metro today. Asthma? Stay inside more.' },
    { max: 200, name: 'Unhealthy', color: '#E74C3C', tip: 'Wear a mask outside and take the metro.' },
    { max: 300, name: 'Very unhealthy', color: '#9B59B6', tip: 'Stay inside and close the windows.' },
    { max: Infinity, name: 'Dangerous', color: '#7E2D3A', tip: 'Stay inside today. The air is dangerous.' }
  ];

  // ----- Works cited (from my presentation) + the live data API -----
  // Each link goes to the exact page the fact came from.
  var SOURCES = [
    { name: 'EcoHubMap', what: 'Air pollution in Cairo, Egypt', url: 'https://www.ecohubmap.com/hot-spot/air-pollution-in-cairo-egypt/1kamamlb968s6k' },
    { name: 'The Global Goals', what: 'Goal 11: Sustainable cities (target 11.6)', url: 'https://www.globalgoals.org/goals/11-sustainable-cities-and-communities/' },
    { name: 'IQAir', what: 'Cairo PM2.5 yearly averages', url: 'https://www.iqair.com/egypt/cairo' },
    { name: 'WHO', what: 'PM2.5 health effects and the safe limit of 5 µg/m³', url: 'https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health' },
    { name: 'Egypt Today', what: 'Egypt targets 60% waste recycling by 2027 (2025)', url: 'https://www.egypttoday.com/Article/1/140752/Egypt-Targets-60-Waste-Recycling-Rate-by-2027' },
    { name: 'ScienceDirect', what: 'Smart waste collection in Greater Cairo (Ain Shams Engineering Journal, 2023)', url: 'https://www.sciencedirect.com/science/article/pii/S2090447923000722' },
    { name: 'Waste & Recycling Magazine', what: "An overview of Egypt's waste management landscape (2024)", url: 'https://www.wasterecyclingmag.com/news/waste-management/an-overview-of-egypt-s-waste-management-landscape' },
    { name: 'Open-Meteo', what: 'Live Cairo air quality API (free, no key)', url: 'https://open-meteo.com/en/docs/air-quality-api' }
  ];

  // ----- Random safe nicknames -----
  var NICK_A = ['Eco', 'Green', 'Clean', 'Nile', 'Metro', 'Solar', 'Fresh', 'Sky'];
  var NICK_B = ['Falcon', 'Hero', 'Lion', 'Star', 'Ranger', 'Hawk', 'Panda', 'Ninja'];

  return {
    FACTS: FACTS, QUIZ: QUIZ, QUIZ_LENGTH: QUIZ_LENGTH, TRASH: TRASH,
    ACTIONS: ACTIONS, AQI_LEVELS: AQI_LEVELS, SOURCES: SOURCES,
    randomNick: function () {
      var a = NICK_A[Math.floor(Math.random() * NICK_A.length)];
      var b = NICK_B[Math.floor(Math.random() * NICK_B.length)];
      return a + ' ' + b + ' ' + Math.floor(Math.random() * 90 + 10);
    }
  };
})();

/** Shuffle a copy of an array (Fisher–Yates). Used by the quiz and game. */
function shuffle(list) {
  var a = list.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
