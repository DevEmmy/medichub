export interface Place { name: string; city: string; state: string; lat: number; lng: number }

export const CITIES: Place[] = [
  { name: 'Lagos', city: 'Lagos', state: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { name: 'Abuja', city: 'Abuja', state: 'FCT', lat: 9.0765, lng: 7.3986 },
  { name: 'Ibadan', city: 'Ibadan', state: 'Oyo', lat: 7.3775, lng: 3.947 },
  { name: 'Port Harcourt', city: 'Port Harcourt', state: 'Rivers', lat: 4.8156, lng: 7.0498 },
  { name: 'Benin City', city: 'Benin City', state: 'Edo', lat: 6.335, lng: 5.6037 },
  { name: 'Enugu', city: 'Enugu', state: 'Enugu', lat: 6.4584, lng: 7.5464 },
  { name: 'Kano', city: 'Kano', state: 'Kano', lat: 12.0022, lng: 8.592 },
  { name: 'Kaduna', city: 'Kaduna', state: 'Kaduna', lat: 10.5105, lng: 7.4165 },
  { name: 'Ilorin', city: 'Ilorin', state: 'Kwara', lat: 8.4966, lng: 4.5421 },
  { name: 'Abeokuta', city: 'Abeokuta', state: 'Ogun', lat: 7.1475, lng: 3.3619 },
  { name: 'Jos', city: 'Jos', state: 'Plateau', lat: 9.8965, lng: 8.8583 },
  { name: 'Zaria', city: 'Zaria', state: 'Kaduna', lat: 11.0855, lng: 7.7199 },
]

export const AREAS: Place[] = [
  { name: 'Lekki Phase 1', city: 'Lagos', state: 'Lagos', lat: 6.4474, lng: 3.4723 },
  { name: 'Ikeja', city: 'Lagos', state: 'Lagos', lat: 6.6018, lng: 3.3515 },
  { name: 'Yaba', city: 'Lagos', state: 'Lagos', lat: 6.5095, lng: 3.3711 },
  { name: 'Surulere', city: 'Lagos', state: 'Lagos', lat: 6.4968, lng: 3.3531 },
  { name: 'Victoria Island', city: 'Lagos', state: 'Lagos', lat: 6.4281, lng: 3.4219 },
  { name: 'Ajah', city: 'Lagos', state: 'Lagos', lat: 6.4698, lng: 3.5852 },
  { name: 'Maitama', city: 'Abuja', state: 'FCT', lat: 9.0833, lng: 7.492 },
  { name: 'Garki', city: 'Abuja', state: 'FCT', lat: 9.0339, lng: 7.4893 },
  { name: 'Wuse', city: 'Abuja', state: 'FCT', lat: 9.0643, lng: 7.4731 },
  { name: 'Gwarinpa', city: 'Abuja', state: 'FCT', lat: 9.1086, lng: 7.4083 },
  { name: 'Bodija', city: 'Ibadan', state: 'Oyo', lat: 7.4352, lng: 3.9133 },
  { name: 'GRA Port Harcourt', city: 'Port Harcourt', state: 'Rivers', lat: 4.8242, lng: 7.0336 },
  { name: 'Independence Layout', city: 'Enugu', state: 'Enugu', lat: 6.4474, lng: 7.5139 },
]

export const ALL_PLACES = [...CITIES, ...AREAS]
export const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara']

/** Simplified outline of Nigeria (lng, lat) used for the schematic map. Not for navigation. */
export const NIGERIA_OUTLINE: [number, number][] = [
  [2.69, 6.37], [2.72, 7.6], [2.75, 9.0], [3.1, 9.4], [3.6, 10.3], [3.6, 11.7], [3.65, 12.5], [4.1, 13.5], [5.5, 13.87], [6.8, 13.1],
  [7.8, 13.33], [9.0, 12.82], [10.1, 13.28], [11.0, 13.38], [12.2, 13.08], [13.6, 13.72], [14.2, 12.45], [14.6, 12.1], [14.25, 11.2],
  [13.3, 10.1], [13.2, 9.0], [12.3, 8.4], [11.9, 7.1], [11.1, 6.45], [10.2, 7.0], [9.4, 6.4], [8.8, 5.5], [8.5, 4.6], [7.1, 4.4],
  [6.0, 4.3], [5.4, 5.2], [4.5, 6.3], [3.4, 6.4], [2.69, 6.37],
]
