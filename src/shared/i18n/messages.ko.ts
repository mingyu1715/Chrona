import type { MessageKey } from './messages.en';

export const koreanMessages = {
  'app.name': 'Chrona',
  'common.cancel': '취소',
  'common.close': '닫기',
  'common.save': '저장',
  'common.system': '시스템 설정',
  'language.korean': '한국어',
  'language.english': '영어',
  'theme.light': '라이트',
  'theme.dark': '다크',
  'backup.completed': '{name} 백업 완료',
} satisfies Record<MessageKey, string>;
