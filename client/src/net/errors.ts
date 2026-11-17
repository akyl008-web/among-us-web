import type { ErrorCode } from '@stellar/shared';

const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Некорректные данные',
  RATE_LIMITED: 'Слишком часто — подождите немного',
  INTERNAL: 'Ошибка сервера',
  ROOM_NOT_FOUND: 'Комната не найдена — проверьте код',
  ROOM_FULL: 'Комната заполнена',
  GAME_IN_PROGRESS: 'Игра уже идёт',
  ALREADY_IN_ROOM: 'Вы уже в комнате',
  NOT_IN_ROOM: 'Вы не в комнате',
  NOT_HOST: 'Это может только хост',
  INVALID_STATE: 'Сейчас это недоступно',
  NOT_ALLOWED: 'Действие недоступно',
  TOO_FAR: 'Слишком далеко',
  COOLDOWN: 'Ещё перезаряжается',
  ALREADY_DONE: 'Уже сделано',
  NOT_ENOUGH_PLAYERS: 'Недостаточно игроков',
  COLOR_TAKEN: 'Цвет уже занят',
  UNAUTHORIZED: 'Сессия устарела',
};

export class ActionError extends Error {
  constructor(readonly code: ErrorCode) {
    super(MESSAGES[code] ?? code);
    this.name = 'ActionError';
  }
}

export function errorText(err: unknown): string {
  if (err instanceof ActionError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Неизвестная ошибка';
}
