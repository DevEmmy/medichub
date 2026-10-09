// Real photographs of Nigerian hospitals from Wikimedia Commons (freely licensed, mostly CC BY-SA).
// Images load straight from Commons at runtime; author and licence are on each file page,
// which the app links to as the credit. If an image can't load (offline, blocked host),
// the UI falls back to the illustrative photo.
// Interior photos of these specific hospitals aren't available under a free licence, so
// interiors stay illustrative and are labelled that way.

export interface RealPhoto { file: string; caption: string }

export const REAL_PHOTOS: Record<string, RealPhoto[]> = {
  h_uith: [{ file: 'University of Ilorin Teaching Hospital (UITH).jpg', caption: 'University of Ilorin Teaching Hospital' }],
  h_akth: [{ file: 'Aminu Kano TH.jpg', caption: 'Aminu Kano Teaching Hospital' }],
  h_uch: [{ file: 'UNIVERSITY COLLEDGE HOSPITAL, Ibadan 3.jpg', caption: 'University College Hospital, Ibadan' }],
  h_fmcabeokuta: [
    { file: 'Federal Medical Centre, Idi-aba, Abeokuta.jpg', caption: 'Federal Medical Centre, Idi-Aba' },
    { file: 'Federal Medical Centre Gate, Idi-aba, Abeokuta.jpg', caption: 'Main gate' },
  ],
  h_oauthc: [{ file: 'Obafemi Awolowo University Teaching Hospital Complex, Ile-Ife, Osun State, Nigeria (12998120914).jpg', caption: 'OAUTHC, Ile-Ife' }],
  h_gbagada: [{ file: 'Gbagada General Hospital.jpg', caption: 'Gbagada General Hospital' }],
  h_oouth: [{ file: 'Olabisi Onabanjo University Teaching Hospital, Sagamu.jpg', caption: 'OOUTH, Sagamu' }],
  h_gwarinpa: [{ file: 'Gwarinpa General Hospital.jpg', caption: 'Gwarinpa General Hospital' }],
  h_stnicholas: [{ file: 'St. Nicholas Hospital, Lagos.jpg', caption: 'St. Nicholas Hospital, Lagos Island' }],
  h_bsuth: [{ file: 'Entrance view of Benue State University Teaching Hospital.jpg', caption: 'Entrance, BSUTH Makurdi' }],
}

export const commonsSrc = (file: string, width = 1280) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`
export const commonsPage = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`
export const realPhotosFor = (id?: string) => (id ? REAL_PHOTOS[id] ?? [] : [])
