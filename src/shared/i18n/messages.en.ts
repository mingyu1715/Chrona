export const englishMessages = {
  'app.name': 'Chrona',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.system': 'System',
  'language.korean': 'Korean',
  'language.english': 'English',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'backup.completed': 'Backup complete: {name}',
} as const;

export type MessageKey = keyof typeof englishMessages;
