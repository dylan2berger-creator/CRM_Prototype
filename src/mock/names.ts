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

// 12 region names.
export const REGION_NAMES = [
  'Great Lakes', 'South Central', 'Gulf Coast', 'Desert Southwest',
  'Mountain West', 'Southeast', 'Pacific Northwest', 'Florida',
  'Mid-South', 'Carolinas', 'Upper Midwest', 'Great Plains',
];

// 14 clients (carriers). isDrp set in the generator; first 9 are DRP.
export const CLIENT_NAMES = [
  'Meridian Mutual', 'Vanguard Casualty', 'Northwind Insurance', 'Ironclad Auto',
  'Summit General', 'Cardinal Assurance', 'Beacon Indemnity', 'Cascade Mutual',
  'Granite State Auto', 'Harborview Insurance', 'Sterling Direct', 'Palmetto Casualty',
  'Yellowstone Mutual', 'Redwood National',
];
