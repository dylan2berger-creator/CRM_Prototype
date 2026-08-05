// Plausible but clearly fictional people and city-based store names.
// No real Boyd employee names. Cities are real US places (used only for
// store/CBSA naming); people are invented.

export const FIRST_NAMES = [
  'Ava', 'Marcus', 'Priya', 'Diego', 'Nora', 'Kenji', 'Simone', 'Terrell',
  'Lena', 'Omar', 'Bianca', 'Wes', 'Ingrid', 'Rafael', 'Dara', 'Miles',
  'Yuki', 'Colton', 'Fatima', 'Grady', 'Sasha', 'Tobias', 'Renata', 'Cyrus',
  'Maren', 'Isaiah', 'Petra', 'Devon', 'Camila', 'Roland', 'Naomi', 'Hugo',
  'Talia', 'Sven', 'Rosa', 'Emmett', 'Zoya', 'Gideon', 'Marisol', 'Beau',
];

export const LAST_NAMES = [
  'Alcott', 'Bränström', 'Castellano', 'Dunmore', 'Eberhardt', 'Falkner',
  'Grimaldi', 'Halloran', 'Ishikawa', 'Juhl', 'Kovac', 'Lindqvist',
  'Marchetti', 'Novak', 'Oyelaran', 'Pashkov', 'Quill', 'Rasmussen',
  'Solberg', 'Tapia', 'Underhill', 'Vitale', 'Wexler', 'Ximenes',
  'Yoshida', 'Zabala', 'Amos', 'Brandt', 'Cho', 'Draeger', 'Ferro',
  'Gunderson', 'Haas', 'Ito', 'Keller', 'Lund', 'Mireles', 'Nagel',
];

// City, state, and the CBSA name it anchors. Fictional store names are
// "<brand> Collision - <city>" (or a nearby suburb) so they read as real
// locations without naming real shops.
export const CITIES: { city: string; state: string; cbsa: string }[] = [
  { city: 'Naperville', state: 'IL', cbsa: 'Chicago-Naperville-Elgin' },
  { city: 'Aurora', state: 'IL', cbsa: 'Chicago-Naperville-Elgin' },
  { city: 'Plano', state: 'TX', cbsa: 'Dallas-Fort Worth-Arlington' },
  { city: 'Arlington', state: 'TX', cbsa: 'Dallas-Fort Worth-Arlington' },
  { city: 'Katy', state: 'TX', cbsa: 'Houston-The Woodlands-Sugar Land' },
  { city: 'Pearland', state: 'TX', cbsa: 'Houston-The Woodlands-Sugar Land' },
  { city: 'Scottsdale', state: 'AZ', cbsa: 'Phoenix-Mesa-Chandler' },
  { city: 'Mesa', state: 'AZ', cbsa: 'Phoenix-Mesa-Chandler' },
  { city: 'Aurora', state: 'CO', cbsa: 'Denver-Aurora-Lakewood' },
  { city: 'Lakewood', state: 'CO', cbsa: 'Denver-Aurora-Lakewood' },
  { city: 'Roswell', state: 'GA', cbsa: 'Atlanta-Sandy Springs-Alpharetta' },
  { city: 'Marietta', state: 'GA', cbsa: 'Atlanta-Sandy Springs-Alpharetta' },
  { city: 'Bellevue', state: 'WA', cbsa: 'Seattle-Tacoma-Bellevue' },
  { city: 'Tacoma', state: 'WA', cbsa: 'Seattle-Tacoma-Bellevue' },
  { city: 'Clearwater', state: 'FL', cbsa: 'Tampa-St. Petersburg-Clearwater' },
  { city: 'Brandon', state: 'FL', cbsa: 'Tampa-St. Petersburg-Clearwater' },
  { city: 'Chandler', state: 'AZ', cbsa: 'Phoenix-Mesa-Chandler' },
  { city: 'Franklin', state: 'TN', cbsa: 'Nashville-Davidson-Murfreesboro' },
  { city: 'Murfreesboro', state: 'TN', cbsa: 'Nashville-Davidson-Murfreesboro' },
  { city: 'Cary', state: 'NC', cbsa: 'Raleigh-Cary' },
  { city: 'Durham', state: 'NC', cbsa: 'Durham-Chapel Hill' },
  { city: 'Bloomington', state: 'MN', cbsa: 'Minneapolis-St. Paul-Bloomington' },
  { city: 'Edina', state: 'MN', cbsa: 'Minneapolis-St. Paul-Bloomington' },
  { city: 'Fishers', state: 'IN', cbsa: 'Indianapolis-Carmel-Anderson' },
  { city: 'Carmel', state: 'IN', cbsa: 'Indianapolis-Carmel-Anderson' },
  { city: 'Henderson', state: 'NV', cbsa: 'Las Vegas-Henderson-Paradise' },
  { city: 'Chesapeake', state: 'VA', cbsa: 'Virginia Beach-Norfolk-Newport News' },
  { city: 'Gilbert', state: 'AZ', cbsa: 'Phoenix-Mesa-Chandler' },
  { city: 'Sandy', state: 'UT', cbsa: 'Salt Lake City' },
  { city: 'Provo', state: 'UT', cbsa: 'Provo-Orem' },
  { city: 'Overland Park', state: 'KS', cbsa: 'Kansas City' },
  { city: 'Olathe', state: 'KS', cbsa: 'Kansas City' },
  { city: 'Round Rock', state: 'TX', cbsa: 'Austin-Round Rock-Georgetown' },
  { city: 'Georgetown', state: 'TX', cbsa: 'Austin-Round Rock-Georgetown' },
  { city: 'Beaverton', state: 'OR', cbsa: 'Portland-Vancouver-Hillsboro' },
  { city: 'Hillsboro', state: 'OR', cbsa: 'Portland-Vancouver-Hillsboro' },
  { city: 'Fort Collins', state: 'CO', cbsa: 'Fort Collins' },
  { city: 'Boulder', state: 'CO', cbsa: 'Boulder' },
  { city: 'Greenville', state: 'SC', cbsa: 'Greenville-Anderson' },
  { city: 'Columbia', state: 'SC', cbsa: 'Columbia' },
  { city: 'Frisco', state: 'TX', cbsa: 'Dallas-Fort Worth-Arlington' },
  { city: 'Sugar Land', state: 'TX', cbsa: 'Houston-The Woodlands-Sugar Land' },
  { city: 'Renton', state: 'WA', cbsa: 'Seattle-Tacoma-Bellevue' },
  { city: 'Kent', state: 'WA', cbsa: 'Seattle-Tacoma-Bellevue' },
  { city: 'Alpharetta', state: 'GA', cbsa: 'Atlanta-Sandy Springs-Alpharetta' },
  { city: 'Kissimmee', state: 'FL', cbsa: 'Orlando-Kissimmee-Sanford' },
  { city: 'Sanford', state: 'FL', cbsa: 'Orlando-Kissimmee-Sanford' },
  { city: 'Livonia', state: 'MI', cbsa: 'Detroit-Warren-Dearborn' },
  { city: 'Troy', state: 'MI', cbsa: 'Detroit-Warren-Dearborn' },
  { city: 'Bellingham', state: 'WA', cbsa: 'Bellingham' },
  { city: 'Spokane', state: 'WA', cbsa: 'Spokane-Spokane Valley' },
  { city: 'Reno', state: 'NV', cbsa: 'Reno' },
  { city: 'Boise', state: 'ID', cbsa: 'Boise City' },
  { city: 'Meridian', state: 'ID', cbsa: 'Boise City' },
  { city: 'Tempe', state: 'AZ', cbsa: 'Phoenix-Mesa-Chandler' },
  { city: 'Wichita', state: 'KS', cbsa: 'Wichita' },
  { city: 'Omaha', state: 'NE', cbsa: 'Omaha-Council Bluffs' },
  { city: 'Lincoln', state: 'NE', cbsa: 'Lincoln' },
  { city: 'Chattanooga', state: 'TN', cbsa: 'Chattanooga' },
  { city: 'Knoxville', state: 'TN', cbsa: 'Knoxville' },
];

// 12 regions grouped into 3 divisions (4 regions each). Order is division-first
// so the roll-up and analysis breakdowns read North, then South, then West.
export const REGIONS: { name: string; division: 'North Division' | 'South Division' | 'West Division' }[] = [
  { name: 'Michiana Region', division: 'North Division' },
  { name: 'Midwest Region', division: 'North Division' },
  { name: 'Northeast Region', division: 'North Division' },
  { name: 'Tennessee Valley', division: 'North Division' },
  { name: 'Carolinas Region', division: 'South Division' },
  { name: 'Florida Region', division: 'South Division' },
  { name: 'Georgia Region', division: 'South Division' },
  { name: 'Gulf Region', division: 'South Division' },
  { name: 'Great Plains Region', division: 'West Division' },
  { name: 'Northwest Region', division: 'West Division' },
  { name: 'Southwest Region', division: 'West Division' },
  { name: 'Texas Region', division: 'West Division' },
];

// Division display order.
export const DIVISIONS: ('North Division' | 'South Division' | 'West Division')[] = [
  'North Division',
  'South Division',
  'West Division',
];

// 14 clients (carriers). Real US property and casualty auto insurers; isDrp is
// set in the generator so the first 9 are DRP. All performance, scorecard, and
// volume data attributed to these names is fabricated for the demo.
export const CLIENT_NAMES = [
  'State Farm', 'GEICO', 'Progressive', 'Allstate',
  'USAA', 'Liberty Mutual', 'Farmers Insurance', 'Nationwide',
  'Travelers', 'American Family Insurance', 'Erie Insurance', 'Auto-Owners Insurance',
  'The Hartford', 'Mercury Insurance',
];
