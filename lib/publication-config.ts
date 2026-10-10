export const NT_ALPHA_PUBLICATION = {
  name: 'NT ALPHA',
  phone: '(11) 99951-7092',
  whatsapp: '5511999517092',
  email: 'nivaldo@ntalpha.com.br',
  website: 'https://www.ntalpha.com.br',
  responsibleName: 'Nivaldo Tonelli',
  logo: 'https://www.ntalpha.com.br/images/ntalpha-logo.png',
} as const;

export const NT_ALPHA_PUBLICATION_RULES = {
  minFeedPhotos: 5,
  maxFeedPhotos: 10,
  maxPhotoBytes: 5 * 1024 * 1024,
  minDescriptionChars: 50,
  maxDescriptionChars: 3000,
} as const;
