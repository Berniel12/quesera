import { createClient } from '@supabase/supabase-js';

const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Sharpen vague questions into specific, clickable predictions
const rewrites = [
  // Macro/Finance
  { slug: 'is-a-recession-coming', text: 'Will the US enter a recession in 2026?' },
  { slug: 'will-groceries-keep-getting-more-expensive', text: 'Will US inflation stay above 3% this year?' },
  { slug: 'will-unemployment-get-worse', text: 'Will US unemployment rise above 5% this year?' },
  { slug: 'will-the-stock-market-keep-climbing', text: 'Will the S&P 500 hit a new all-time high this year?' },
  { slug: 'will-home-prices-come-down', text: 'Will US home prices drop in 2026?' },
  { slug: 'will-gas-prices-keep-rising', text: 'Will US gas prices hit $5 per gallon this year?' },
  { slug: 'will-mortgages-go-down', text: 'Will mortgage rates fall below 5.5% this year?' },
  { slug: 'will-oil-prices-spike', text: 'Will oil hit $100 per barrel this year?' },
  { slug: 'is-the-dollar-getting-weaker', text: 'Will the US dollar lose more ground in 2026?' },
  { slug: 'will-food-prices-keep-climbing', text: 'Will global food prices rise another 10% this year?' },
  { slug: 'will-crypto-break-out-of-its-current-range', text: 'Will crypto total market cap hit $5 trillion this year?' },
  { slug: 'are-americans-feeling-good-about-the-economy', text: 'Will US consumer confidence recover in 2026?' },
  { slug: 'will-ecb-interest-rates-change', text: 'Will the ECB cut rates before the Fed?' },
  { slug: 'will-uk-inflation-keep-rising', text: 'Will UK inflation fall below 2% this year?' },

  // Geopolitics
  { slug: 'will-the-russia-ukraine-war-end-soon', text: 'Will there be a Russia-Ukraine ceasefire by year-end?' },
  { slug: 'will-there-be-a-ceasefire', text: 'Will the Gaza war end by summer 2026?' },
  { slug: 'will-the-iran-us-conflict-escalate-further', text: 'Will the US and Iran go to war?' },
  { slug: 'will-china-invade-taiwan', text: 'Will China blockade or invade Taiwan by 2027?' },
  { slug: 'will-the-lebanon-conflict-spread', text: 'Will the Lebanon conflict pull in more countries?' },
  { slug: 'will-the-sudan-crisis-escalate', text: 'Will the Sudan civil war spill across borders?' },
  { slug: 'will-the-venezuela-crisis-get-worse', text: 'Will Venezuela face a regime change in 2026?' },
  { slug: 'will-north-korea-provoke-again', text: 'Will North Korea test a nuclear weapon this year?' },
  { slug: 'will-iran-get-nuclear-weapons', text: 'Will Iran build a nuclear bomb by 2027?' },
  { slug: 'is-nato-getting-stronger', text: 'Will NATO increase defense spending above 3% of GDP?' },
  { slug: 'will-the-eu-face-a-breakup-crisis', text: 'Will any EU country trigger an exit referendum by 2027?' },
  { slug: 'will-us-cuba-relations-improve', text: 'Will the US lift Cuba sanctions in 2026?' },
  { slug: 'will-climate-talks-produce-a-breakthrough', text: 'Will COP31 produce a binding emissions deal?' },

  // Politics
  { slug: 'will-tariffs-keep-increasing', text: 'Will US tariffs on China exceed 60% this year?' },
  { slug: 'will-immigration-policy-change', text: 'Will the US pass new immigration legislation in 2026?' },
  { slug: 'will-ai-get-regulated', text: 'Will Congress pass an AI regulation bill this year?' },
  { slug: 'will-congress-raise-the-debt-ceiling', text: 'Will the US hit the debt ceiling before a deal?' },
  { slug: 'will-healthcare-costs-come-down', text: 'Will Congress cap insulin prices nationwide?' },
  { slug: 'will-congress-pass-major-legislation', text: 'Will Congress pass a major spending bill in 2026?' },
  { slug: 'will-the-supreme-court-make-a-landmark-ruling-this-term', text: 'Will the Supreme Court overturn a major precedent this term?' },

  // Tech
  { slug: 'will-tesla-stock-break-out-of-its-range', text: 'Will Tesla stock double from here this year?' },
  { slug: 'will-tiktok-get-banned', text: 'Will TikTok be banned in the US by 2027?' },
  { slug: 'will-starship-development-hit-a-major-setback', text: 'Will SpaceX Starship reach orbit this year?' },
  { slug: 'will-apples-next-launch-shake-up-the-market', text: 'Will Apple launch a foldable device in 2026?' },
  { slug: 'will-the-mcu-stage-a-comeback', text: 'Will a Marvel movie gross over $1 billion in 2026?' },

  // Entertainment
  { slug: 'will-taylor-swift-release-a-new-album-this-year', text: 'Will Taylor Swift release a new album in 2026?' },

  // Disasters
  { slug: 'will-this-hurricane-season-be-bad', text: 'Will a Category 5 hurricane hit the US this year?' },
  { slug: 'will-wildfires-get-worse-this-year', text: 'Will California wildfires burn more than 1 million acres this year?' },
];

let updated = 0;
for (const r of rewrites) {
  const { data, error } = await c.from('questions')
    .update({ question_text: r.text })
    .eq('slug', r.slug)
    .select('slug');
  if (error) console.log('ERROR:', r.slug, error.message);
  else if (data && data.length > 0) updated++;
}
console.log(`Rewrote ${updated} questions`);

// Un-feature questions that don't belong on homepage
const unfeatured = [
  'will-severe-weather-cause-damage-this-week',
  'will-a-major-earthquake-hit-this-week',
  'what-will-happen-in-france-elections',
  'what-will-happen-in-brazil-politics',
  'what-will-happen-in-india-elections',
  'what-will-happen-in-uk-elections',
];

let removed = 0;
for (const slug of unfeatured) {
  const { data, error } = await c.from('questions')
    .update({ is_featured: false })
    .eq('slug', slug)
    .select('slug');
  if (error) console.log('ERROR unfeaturing:', slug, error.message);
  else if (data && data.length > 0) { removed++; console.log('Unfeatured:', slug); }
}
console.log(`Unfeatured ${removed} questions`);
